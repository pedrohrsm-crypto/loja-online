// Cobrança Pix do pedido reservado (L3), pura: as portas (banco e Mercado Pago) chegam por parâmetro.
//
// - Só o DONO do pedido, com o pedido ABERTO e no prazo, gera o Pix (FIDELIDADE §1, mapa de acesso, tela 7).
// - O total vem do pedido congelado no banco (recalculado no servidor pelo #27), nunca do navegador (T17).
// - `X-Idempotency-Key` derivada do pedido: duas abas geram a mesma order. Se a chave já foi usada
//   (409 `idempotency_key_already_used`), a outra aba já gravou: relê o pedido (T12).
// - A order se liga ao pedido pelo `mp_order_id` gravado aqui, com `UPDATE … WHERE mp_order_id IS NULL`
//   conferindo 1 linha (FIDELIDADE §1, regra 4).
// - Pedido `substituido` (o carrinho mudou: T18): a order do pedido anterior é CANCELADA no Mercado Pago.
//   Se o cancelamento falhar (a order já foi paga, ou a rede caiu), a reconciliação decide pelo GET.
// - `payer` só com o que a Orders API exige (o e-mail). Em modo de teste, `first_name = "APRO"`, que
//   faz a sandbox aprovar o Pix sozinha (doc "Realizar compra de teste com Pix", 4-Nov-2026). Em
//   produção, nunca.
import { log } from '@/lib/observabilidade/logger';
import { chaveDoCheckout } from './chave';
import type { ConfigMP } from './config';
import { conferirOrder, type PortasConfirmacao } from './confirmar';
import { lerOrder, type OrderMP } from './order';
import { centavosParaMP } from './valor';

/** Prazo do Pix: o mínimo que o Mercado Pago aceita, igual ao da reserva (migration 20261103000001). */
export const PRAZO_PIX_ISO = 'PT30M';
export const NOME_TESTE_APROVA = 'APRO';

export type PedidoParaPix = {
  id: string;
  usuarioId: string | null;
  status: string;
  totalCentavos: number;
  expiraEm: string;
  mpOrderId: string | null;
  qrCode: string | null;
  qrCodeBase64: string | null;
};

export type DadosCobranca = { mpOrderId: string; qrCode: string | null; qrCodeBase64: string | null; ticketUrl: string | null };

export interface PortasCobranca extends PortasConfirmacao {
  /** Lança em erro de banco. null = não existe (ou é do starter). */
  lerPedido(id: string): Promise<PedidoParaPix | null>;
  /** Grava a order no pedido aberto ainda sem order. true = 1 linha. Lança em erro de banco. */
  gravarCobranca(pedidoId: string, dados: DadosCobranca, modo: ConfigMP['modo']): Promise<boolean>;
  /** Completa o Pix de uma order já gravada (criação assíncrona: a order veio sem QR). */
  completarPix(pedidoId: string, dados: DadosCobranca): Promise<boolean>;
  criarOrder(corpo: unknown, chave: string): Promise<{ ok: true; json: unknown } | { ok: false; transitorio: boolean; status: number | null; codigo: string | null }>;
  cancelarOrder(orderId: string, chave: string): Promise<{ ok: boolean; transitorio: boolean }>;
  /** Pedidos cancelados do comprador com order ainda viva no Mercado Pago. */
  cobrancasVivasCanceladas(usuarioId: string): Promise<{ id: string; mpOrderId: string }[]>;
  marcarCanceladaNoMP(pedidoId: string): Promise<void>;
}

export type ResultadoGerarPix =
  | { ok: true; criada: boolean }
  | { ok: false; motivo: 'nao-encontrado' | 'fechado' | 'expirado' | 'em-andamento' | 'indisponivel' };

const ESCOPO = 'pagamentos.pix';

export function corpoDaOrder(pedido: Pick<PedidoParaPix, 'id' | 'totalCentavos'>, email: string, modo: ConfigMP['modo']) {
  const valor = centavosParaMP(pedido.totalCentavos);
  return {
    type: 'online',
    processing_mode: 'automatic',
    external_reference: pedido.id,
    total_amount: valor,
    payer: modo === 'teste' ? { email, first_name: NOME_TESTE_APROVA } : { email },
    transactions: { payments: [{ amount: valor, payment_method: { id: 'pix', type: 'bank_transfer' }, expiration_time: PRAZO_PIX_ISO }] },
  };
}

/** A chave não leva o e-mail (dado pessoal) nem o relógio: o mesmo pedido, no mesmo modo, é a mesma order. */
export function chaveDaOrder(pedido: Pick<PedidoParaPix, 'id' | 'totalCentavos'>, modo: ConfigMP['modo']): string {
  return chaveDoCheckout(pedido.id, { meio: 'pix', modo, total: String(pedido.totalCentavos), prazo: PRAZO_PIX_ISO });
}

export function chaveDoCancelamento(pedidoId: string): string {
  return `cancelar-${pedidoId}`;
}

function dadosDa(order: OrderMP): DadosCobranca {
  return { mpOrderId: order.id, qrCode: order.pix?.qrCode ?? null, qrCodeBase64: order.pix?.qrCodeBase64 ?? null, ticketUrl: order.pix?.ticketUrl ?? null };
}

/** Cancela no Mercado Pago as orders dos pedidos que este substituiu. Nunca derruba o Pix novo. */
export async function cancelarSubstituidos(usuarioId: string, portas: PortasCobranca): Promise<number> {
  let canceladas = 0;
  let vivas: { id: string; mpOrderId: string }[];
  try {
    vivas = await portas.cobrancasVivasCanceladas(usuarioId);
  } catch (e) {
    log.error(ESCOPO, 'falha ao ler cobranças anteriores', { erro: e instanceof Error ? e.message : String(e) });
    return 0;
  }
  for (const v of vivas) {
    try {
      const r = await portas.cancelarOrder(v.mpOrderId, chaveDoCancelamento(v.id));
      if (!r.ok) {
        log.warn(ESCOPO, 'cancelamento da order anterior falhou; a reconciliação decide pelo GET', { pedido: v.id, transitorio: r.transitorio });
        continue;
      }
      await portas.marcarCanceladaNoMP(v.id);
      canceladas += 1;
    } catch (e) {
      log.error(ESCOPO, 'falha ao cancelar a order anterior', { pedido: v.id, erro: e instanceof Error ? e.message : String(e) });
    }
  }
  return canceladas;
}

export async function gerarPix(
  p: { pedidoId: string; usuarioId: string; email: string | null; config: ConfigMP; agoraMs?: number },
  portas: PortasCobranca,
): Promise<ResultadoGerarPix> {
  let pedido: PedidoParaPix | null;
  try {
    pedido = await portas.lerPedido(p.pedidoId);
  } catch (e) {
    log.error(ESCOPO, 'falha ao ler o pedido', { pedido: p.pedidoId, erro: e instanceof Error ? e.message : String(e) });
    return { ok: false, motivo: 'indisponivel' };
  }
  // Pedido de outra pessoa responde igual a inexistente (S-06).
  if (!pedido || pedido.usuarioId !== p.usuarioId) return { ok: false, motivo: 'nao-encontrado' };
  if (pedido.status !== 'aberto') return { ok: false, motivo: 'fechado' };
  if (pedido.mpOrderId) return { ok: true, criada: false };
  if (new Date(pedido.expiraEm).getTime() <= (p.agoraMs ?? Date.now())) return { ok: false, motivo: 'expirado' };
  if (!p.email) {
    log.error(ESCOPO, 'comprador sem e-mail na sessão', { pedido: pedido.id });
    return { ok: false, motivo: 'indisponivel' };
  }

  const r = await portas.criarOrder(corpoDaOrder(pedido, p.email, p.config.modo), chaveDaOrder(pedido, p.config.modo));
  if (!r.ok) {
    if (r.status === 409) {
      // A mesma chave já criou a order (outra aba): ela grava; esta relê na próxima atualização.
      return { ok: false, motivo: 'em-andamento' };
    }
    // Recusa do Mercado Pago (ex.: conta sem chave Pix): o código vai para o log, a tela diz "indisponível".
    log.error(ESCOPO, 'order Pix não criada', { pedido: pedido.id, status: r.status, codigo: r.codigo, transitorio: r.transitorio });
    return { ok: false, motivo: 'indisponivel' };
  }
  const order = lerOrder(r.json);
  if (!order) {
    log.error(ESCOPO, 'resposta da order em formato inesperado', { pedido: pedido.id });
    return { ok: false, motivo: 'indisponivel' };
  }

  let gravou: boolean;
  try {
    gravou = await portas.gravarCobranca(pedido.id, dadosDa(order), p.config.modo);
  } catch (e) {
    log.error(ESCOPO, 'falha ao gravar a order', { pedido: pedido.id, order: order.id, erro: e instanceof Error ? e.message : String(e) });
    return { ok: false, motivo: 'indisponivel' };
  }
  if (!gravou) {
    // O pedido saiu de 'aberto' entre a leitura e a gravação (expirou ou foi substituído): a order
    // nova não pode ficar viva sem pedido. Cancela; se falhar, fica no log (a order expira em 30 min).
    log.warn(ESCOPO, 'pedido mudou antes de gravar a order; cancelando a order', { pedido: pedido.id, order: order.id });
    const c = await portas.cancelarOrder(order.id, chaveDoCancelamento(pedido.id)).catch(() => ({ ok: false, transitorio: true }));
    if (!c.ok) log.error(ESCOPO, 'order órfã não cancelada', { pedido: pedido.id, order: order.id });
    return { ok: false, motivo: 'fechado' };
  }
  log.info(ESCOPO, 'order Pix criada', { pedido: pedido.id, order: order.id, total: pedido.totalCentavos, modo: p.config.modo });
  await cancelarSubstituidos(p.usuarioId, portas);
  return { ok: true, criada: true };
}

/**
 * A tela consulta o estado REAL: com o Pix gerado e o pedido aberto, faz o GET da order e confirma se
 * já foi paga (o webhook pode atrasar, ou nem chegar na prévia). Completa o QR se a order veio sem ele.
 * Nunca lança: falha aqui só adia a confirmação para o webhook ou a reconciliação.
 */
export async function consultarPix(pedido: PedidoParaPix, config: ConfigMP, portas: PortasCobranca): Promise<'pago' | 'sem-mudanca'> {
  if (pedido.status !== 'aberto' || !pedido.mpOrderId) return 'sem-mudanca';
  try {
    const c = await conferirOrder(pedido.mpOrderId, config.modo, portas, ESCOPO);
    if (c.tipo === 'confirmado') return c.resultado === 'pago' || c.resultado === 'reativado' || c.resultado === 'ja-pago' ? 'pago' : 'sem-mudanca';
    if (c.tipo === 'sem-efeito' && !pedido.qrCode && c.order.pix) await portas.completarPix(pedido.id, dadosDa(c.order));
  } catch (e) {
    log.warn(ESCOPO, 'consulta da order adiada', { pedido: pedido.id, erro: e instanceof Error ? e.message : String(e) });
  }
  return 'sem-mudanca';
}

