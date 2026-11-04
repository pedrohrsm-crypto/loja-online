// "Esta order foi paga? Então este pedido está pago." Um lugar só para o webhook (L4), a reconciliação
// (L5) e a tela do Pix (L3) decidirem a partir do GET /v1/orders/{id}, nunca do corpo da notificação.
// Quem faz a transição é a função de banco confirmar_pagamento_mp (migration 20261104000001): ela confere
// modo, pedido e valor, e paga uma vez só.
import { log } from '@/lib/observabilidade/logger';
import type { ModoPagamento } from './config';
import { lerOrder, situacaoDaOrder, type OrderMP, type SituacaoOrder } from './order';

export const RESULTADOS = ['pago', 'reativado', 'ja-pago', 'estorno-pendente', 'valor-divergente', 'pedido-divergente', 'modo-divergente', 'nao-encontrado'] as const;
export type ResultadoConfirmacao = (typeof RESULTADOS)[number];

/** Falha que tentar de novo pode resolver (rede, banco, Mercado Pago fora): webhook 500, reconciliação conta falha. */
export class FalhaTransitoria extends Error {}

export type LeituraOrderRemota = { ok: true; json: unknown } | { ok: false; transitorio: boolean };

export interface PortasConfirmacao {
  buscarOrder(orderId: string): Promise<LeituraOrderRemota>;
  /** Lança FalhaTransitoria em erro de banco. */
  confirmar(a: { orderId: string; externalReference: string | null; valorCentavos: number; modo: ModoPagamento }): Promise<ResultadoConfirmacao>;
}

export type Conferencia =
  | { tipo: 'confirmado'; resultado: ResultadoConfirmacao; order: OrderMP }
  | { tipo: 'sem-efeito'; situacao: SituacaoOrder; order: OrderMP }
  | { tipo: 'order-invalida' };

const ALERTAS: Partial<Record<ResultadoConfirmacao, string>> = {
  'estorno-pendente': 'pago depois de expirar e sem estoque: estornar (F4b)',
  'valor-divergente': 'order paga com valor diferente do pedido',
  'pedido-divergente': 'order paga ligada a outro pedido',
};

/** Lança FalhaTransitoria quando o GET ou o banco falham de um jeito que tentar de novo resolve. */
export async function conferirOrder(orderId: string, modo: ModoPagamento, portas: PortasConfirmacao, escopo: string): Promise<Conferencia> {
  const r = await portas.buscarOrder(orderId);
  if (!r.ok) {
    if (r.transitorio) throw new FalhaTransitoria('GET da order falhou');
    log.warn(escopo, 'order recusada pelo Mercado Pago', { order: orderId });
    return { tipo: 'order-invalida' };
  }
  const order = lerOrder(r.json);
  if (!order || order.id !== orderId) {
    log.error(escopo, 'order em formato inesperado', { order: orderId });
    return { tipo: 'order-invalida' };
  }
  const situacao = situacaoDaOrder(order);
  if (situacao !== 'paga') return { tipo: 'sem-efeito', situacao, order };
  // Sem valor legível, -1 nunca bate com o total congelado: vira 'valor-divergente', nunca 'pago'.
  const resultado = await portas.confirmar({ orderId, externalReference: order.externalReference, valorCentavos: order.totalCentavos ?? -1, modo });
  const alerta = ALERTAS[resultado];
  if (alerta) log.error('pagamentos.alerta', alerta, { order: orderId, resultado });
  else if (resultado === 'modo-divergente' || resultado === 'nao-encontrado') log.warn(escopo, 'order paga sem efeito', { order: orderId, resultado });
  else log.info(escopo, 'pagamento confirmado', { order: orderId, resultado });
  return { tipo: 'confirmado', resultado, order };
}

export function ehResultado(v: unknown): v is ResultadoConfirmacao {
  return typeof v === 'string' && (RESULTADOS as readonly string[]).includes(v);
}
