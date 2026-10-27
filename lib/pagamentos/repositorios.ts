// Implementações no Supabase das portas do webhook e dos tratadores (service_role).
// Toda escrita passa por `escrever` e confere as linhas; erro de banco sobe como exceção,
// e o webhook responde 500 para o processador retentar.
import type { SupabaseClient } from '@supabase/supabase-js';
import { escrever } from '@/lib/supabase/escrever';
import type { RepositorioEventos, Reserva } from './webhook';
import type { RepositorioPedidos, StatusPedido } from './tratadores';

class ErroBanco extends Error {}

export function repositorioEventos(db: SupabaseClient): RepositorioEventos {
  return {
    async reservar(id, tipo) {
      const { data, error } = await db.rpc('reservar_evento_pagamento', { p_id: id, p_tipo: tipo });
      if (error) throw new ErroBanco(`reservar: ${error.code}`);
      return data as Reserva;
    },
    async concluir(id) {
      const r = await escrever(db.from('eventos_pagamento').update({ processado_em: new Date().toISOString() }).eq('id', id).select('id'), {
        esperado: 1, escopo: 'pagamentos.evento.concluir', contexto: { evento: id },
      });
      if (!r.ok) throw new ErroBanco('concluir evento');
    },
    async devolver(id) {
      const { error } = await db.from('eventos_pagamento').delete().eq('id', id).is('processado_em', null);
      if (error) throw new ErroBanco(`devolver: ${error.code}`);
    },
  };
}

export function repositorioPedidos(db: SupabaseClient): RepositorioPedidos {
  return {
    async marcarPago(pedidoId, sessaoId, pagamentoId) {
      const r = await escrever(
        db.from('pedidos').update({ status: 'pago', pago_em: new Date().toISOString(), stripe_sessao_id: sessaoId, stripe_pagamento_id: pagamentoId })
          .eq('id', pedidoId).eq('status', 'aberto').select('id'),
        { esperado: 'um-ou-mais', escopo: 'pagamentos.pedido.pago', contexto: { pedido: pedidoId } },
      );
      if (r.erro) throw new ErroBanco('marcar pago');
      return r.linhas;
    },
    async lerStatus(pedidoId) {
      const { data, error } = await db.from('pedidos').select('status').eq('id', pedidoId).maybeSingle();
      if (error) throw new ErroBanco(`ler pedido: ${error.code}`);
      return (data?.status as StatusPedido | undefined) ?? null;
    },
    async marcarEstornado(pagamentoId) {
      const r = await escrever(
        db.from('pedidos').update({ status: 'estornado', estornado_em: new Date().toISOString() }).eq('stripe_pagamento_id', pagamentoId).eq('status', 'pago').select('id'),
        { esperado: 'um-ou-mais', escopo: 'pagamentos.pedido.estornado', contexto: { pagamento: pagamentoId } },
      );
      if (r.erro) throw new ErroBanco('marcar estornado');
      return r.linhas;
    },
  };
}
