// Portas reais (Supabase com a service_role e Orders API do Mercado Pago) do Pix, do webhook e da
// reconciliação. Só no servidor. Toda escrita confere as linhas (`escrever`); erro de banco sobe como
// exceção (FalhaTransitoria): o webhook responde 500 e o Mercado Pago tenta de novo.
//
// Schema antigo (migration 20261104000001 ainda não aplicada): coluna ausente (42703/PGRST204) e função
// ausente (PGRST202/42883) viram ErroSchemaAntigo, que a tela mostra como "pagamento indisponível" e o
// webhook responde 500 (o Mercado Pago tenta de novo depois do deploy da migration).
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { log } from '@/lib/observabilidade/logger';
import { ehColunaAusente } from '@/lib/supabase/coluna-ausente';
import { escrever } from '@/lib/supabase/escrever';
import { expirarPedidosVencidos } from '@/lib/pedidos/reserva';
import type { PortasCobranca, PedidoParaPix } from './cobranca';
import type { ConfigMP } from './config';
import { FalhaTransitoria, ehResultado, type PortasConfirmacao } from './confirmar';
import { chamarMP } from './mercadopago';
import type { PedidoComOrder, PortasReconciliacao } from './reconciliar';
import type { RepositorioEventos, Reserva } from './webhook';

export class ErroSchemaAntigo extends FalhaTransitoria {}

const FUNCAO_AUSENTE = new Set(['PGRST202', '42883']);
const ID_ORDER = /^[A-Za-z0-9_-]{1,64}$/;

function erroDeBanco(onde: string, codigo: string | undefined): FalhaTransitoria {
  if (ehColunaAusente(codigo) || FUNCAO_AUSENTE.has(codigo ?? '')) return new ErroSchemaAntigo(`${onde}: schema antigo (${codigo})`);
  return new FalhaTransitoria(`${onde}: ${codigo ?? 'sem código'}`);
}

function caminhoDaOrder(id: string, sufixo = ''): string {
  if (!ID_ORDER.test(id)) throw new FalhaTransitoria('id de order inválido');
  return `/v1/orders/${encodeURIComponent(id)}${sufixo}`;
}

export function repositorioEventos(db: SupabaseClient): RepositorioEventos {
  return {
    async reservar(id, tipo) {
      const { data, error } = await db.rpc('reservar_evento_pagamento', { p_id: id, p_tipo: tipo });
      if (error) throw erroDeBanco('reservar evento', error.code);
      if (data !== 'reservado' && data !== 'recuperado' && data !== 'duplicado' && data !== 'em-andamento') throw new FalhaTransitoria('reserva: resposta inesperada');
      return data as Reserva;
    },
    async concluir(id) {
      const r = await escrever(db.from('eventos_pagamento').update({ processado_em: new Date().toISOString() }).eq('id', id).select('id'), {
        esperado: 1, escopo: 'pagamentos.evento.concluir', contexto: { evento: id },
      });
      if (!r.ok) throw new FalhaTransitoria('concluir evento');
    },
    async devolver(id) {
      const { error } = await db.from('eventos_pagamento').delete().eq('id', id).is('processado_em', null);
      if (error) throw erroDeBanco('devolver evento', error.code);
    },
  };
}

function portasConfirmacao(db: SupabaseClient, config: ConfigMP): PortasConfirmacao {
  return {
    async buscarOrder(orderId) {
      const r = await chamarMP<unknown>(config, caminhoDaOrder(orderId), { escopo: 'pagamentos.mp.ler' });
      return r.ok ? { ok: true, json: r.dados } : { ok: false, transitorio: r.transitorio };
    },
    async confirmar(a) {
      const { data, error } = await db.rpc('confirmar_pagamento_mp', {
        p_mp_order_id: a.orderId, p_external_reference: a.externalReference, p_valor_centavos: a.valorCentavos, p_modo: a.modo,
      });
      if (error) throw erroDeBanco('confirmar_pagamento_mp', error.code);
      if (!ehResultado(data)) throw new FalhaTransitoria('confirmar_pagamento_mp: resposta inesperada');
      return data;
    },
  };
}

async function cancelarOrder(config: ConfigMP, orderId: string, chave: string) {
  const r = await chamarMP<unknown>(config, caminhoDaOrder(orderId, '/cancel'), { metodo: 'POST', chaveIdempotencia: chave, escopo: 'pagamentos.mp.cancelar' });
  return { ok: r.ok, transitorio: r.ok ? false : r.transitorio };
}

async function marcarCanceladaNoMP(db: SupabaseClient, pedidoId: string) {
  const r = await escrever(
    db.from('pedidos').update({ mp_cancelado_em: new Date().toISOString() }).eq('id', pedidoId).eq('status', 'cancelado').is('mp_cancelado_em', null).select('id'),
    { esperado: 1, escopo: 'pagamentos.mp.cancelada', contexto: { pedido: pedidoId } },
  );
  if (r.erro) throw erroDeBanco('marcar cancelada', r.erro.code);
}

const COLUNAS_PIX = 'id, usuario_id, status, total_centavos, expira_em, produto, mp_order_id, mp_qr_code, mp_qr_code_base64';

type LinhaPix = {
  id: string; usuario_id: string | null; status: string; total_centavos: number | null; expira_em: string | null;
  produto: string | null; mp_order_id: string | null; mp_qr_code: string | null; mp_qr_code_base64: string | null;
};

export function linhaParaPedido(l: LinhaPix): PedidoParaPix | null {
  // Pedido do starter (produto único) não tem Pix: para esta tela, não existe.
  if (l.produto !== null || l.total_centavos === null || l.expira_em === null) return null;
  return {
    id: l.id, usuarioId: l.usuario_id, status: l.status, totalCentavos: l.total_centavos, expiraEm: l.expira_em,
    mpOrderId: l.mp_order_id, qrCode: l.mp_qr_code, qrCodeBase64: l.mp_qr_code_base64,
  };
}

export function portasCobranca(db: SupabaseClient, config: ConfigMP): PortasCobranca {
  return {
    ...portasConfirmacao(db, config),
    async lerPedido(id) {
      const { data, error } = await db.from('pedidos').select(COLUNAS_PIX).eq('id', id).maybeSingle();
      if (error) throw erroDeBanco('ler pedido', error.code);
      return data ? linhaParaPedido(data as LinhaPix) : null;
    },
    async gravarCobranca(pedidoId, d, modo) {
      const r = await escrever(
        db.from('pedidos').update({
          mp_order_id: d.mpOrderId, mp_qr_code: d.qrCode, mp_qr_code_base64: d.qrCodeBase64, mp_ticket_url: d.ticketUrl,
          mp_criado_em: new Date().toISOString(), modo,
        }).eq('id', pedidoId).eq('status', 'aberto').is('produto', null).is('mp_order_id', null).select('id'),
        { esperado: 1, escopo: 'pagamentos.pix.gravar', contexto: { pedido: pedidoId } },
      );
      if (r.erro) throw erroDeBanco('gravar cobrança', r.erro.code);
      return r.ok;
    },
    async completarPix(pedidoId, d) {
      const r = await escrever(
        db.from('pedidos').update({ mp_qr_code: d.qrCode, mp_qr_code_base64: d.qrCodeBase64, mp_ticket_url: d.ticketUrl })
          .eq('id', pedidoId).eq('mp_order_id', d.mpOrderId).is('mp_qr_code', null).select('id'),
        { esperado: 1, escopo: 'pagamentos.pix.completar', contexto: { pedido: pedidoId } },
      );
      if (r.erro) throw erroDeBanco('completar Pix', r.erro.code);
      return r.ok;
    },
    async criarOrder(corpo, chave) {
      const r = await chamarMP<unknown>(config, '/v1/orders', { metodo: 'POST', corpo, chaveIdempotencia: chave, escopo: 'pagamentos.mp.criar' });
      return r.ok ? { ok: true, json: r.dados } : r;
    },
    cancelarOrder: (orderId, chave) => cancelarOrder(config, orderId, chave),
    async cobrancasVivasCanceladas(usuarioId) {
      const { data, error } = await db.from('pedidos').select('id, mp_order_id').eq('usuario_id', usuarioId).eq('status', 'cancelado')
        .not('mp_order_id', 'is', null).is('mp_cancelado_em', null).order('criado_em', { ascending: false }).limit(10);
      if (error) throw erroDeBanco('ler cobranças anteriores', error.code);
      return ((data ?? []) as { id: string; mp_order_id: string }[]).map((l) => ({ id: l.id, mpOrderId: l.mp_order_id }));
    },
    marcarCanceladaNoMP: (pedidoId) => marcarCanceladaNoMP(db, pedidoId),
  };
}

export function portasReconciliacao(db: SupabaseClient, config: ConfigMP): PortasReconciliacao {
  return {
    ...portasConfirmacao(db, config),
    async adquirirTrava(nome, duracaoMs) {
      const { data, error } = await db.rpc('adquirir_trava_rotina', { p_nome: nome, p_duracao: `${Math.round(duracaoMs / 1000)} seconds` });
      if (error) throw erroDeBanco('adquirir trava', error.code);
      return typeof data === 'string' ? data : null;
    },
    async liberarTrava(nome, dono) {
      const { data, error } = await db.rpc('liberar_trava_rotina', { p_nome: nome, p_dono: dono });
      if (error) throw erroDeBanco('liberar trava', error.code);
      if (data !== true) log.warn('pagamentos.reconciliar', 'a trava já não era desta rodada (venceu)');
    },
    expirarVencidos: () => expirarPedidosVencidos(db),
    async pedidosComOrderViva(limite) {
      // Só os últimos 3 dias: depois disso, o Pix (30 min) e a reentrega do webhook já acabaram há muito.
      const desde = new Date(Date.now() - 3 * 24 * 3_600_000).toISOString();
      const { data, error } = await db.from('pedidos').select('id, status, mp_order_id').in('status', ['aberto', 'cancelado'])
        .not('mp_order_id', 'is', null).is('mp_cancelado_em', null).gte('criado_em', desde).order('criado_em').limit(limite);
      if (error) throw erroDeBanco('ler pedidos com order', error.code);
      return ((data ?? []) as { id: string; status: 'aberto' | 'cancelado'; mp_order_id: string }[]).map((l): PedidoComOrder => ({ id: l.id, status: l.status, mpOrderId: l.mp_order_id }));
    },
    cancelarOrder: (orderId, chave) => cancelarOrder(config, orderId, chave),
    marcarCanceladaNoMP: (pedidoId) => marcarCanceladaNoMP(db, pedidoId),
  };
}

export function portasWebhook(db: SupabaseClient, config: ConfigMP) {
  return { eventos: repositorioEventos(db), portas: portasConfirmacao(db, config) };
}
