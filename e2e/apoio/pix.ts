// Apoio do e2e do Pix (#32): semear pedido e order nos falsos, e assinar a notificação do webhook como o
// Mercado Pago assina (manifest `id:…;request-id:…;ts:…;`, HMAC-SHA256 em hexadecimal). O segredo é
// FICTÍCIO e o mesmo que o playwright.config.ts entrega ao servidor.
import { createHmac, randomUUID } from 'node:crypto';
import type { APIRequestContext } from '@playwright/test';

export const SEGREDO_WEBHOOK_FALSO = 'segredo-do-webhook-de-teste';

const PORTA = Number(process.env.E2E_PORTA ?? 3100);
export const URL_SUPABASE_FALSO = `http://127.0.0.1:${PORTA + 1}`;
export const URL_MP_FALSO = `http://127.0.0.1:${PORTA + 2}`;

export type PedidoSemeado = { id: string; status: string; total_centavos: number; mp_order_id: string | null; itens_pedido: { variacao_id: string; quantidade: number }[] };

export async function semearPedido(request: APIRequestContext, dados: Record<string, unknown>): Promise<PedidoSemeado> {
  const r = await request.post(`${URL_SUPABASE_FALSO}/teste/pedido`, { data: dados });
  return (await r.json()) as PedidoSemeado;
}

export async function lerPedido(request: APIRequestContext, id: string): Promise<PedidoSemeado & Record<string, unknown>> {
  return (await (await request.get(`${URL_SUPABASE_FALSO}/teste/pedido/${id}`)).json()) as PedidoSemeado & Record<string, unknown>;
}

/** Liga a order ao pedido, como a criação do Pix faria (mp_order_id). */
export async function ligarOrder(request: APIRequestContext, pedidoId: string, orderId: string) {
  await request.patch(`${URL_SUPABASE_FALSO}/teste/pedido/${pedidoId}`, { data: { mp_order_id: orderId, mp_qr_code: `000201-${orderId}`, mp_criado_em: new Date().toISOString() } });
}

export async function semearOrder(request: APIRequestContext, externalReference: string, totalAmount: string, extra: Record<string, unknown> = {}) {
  const id = `ORD01E2E${randomUUID().replace(/-/g, '').slice(0, 16).toUpperCase()}`;
  await request.post(`${URL_MP_FALSO}/teste/order`, { data: { id, external_reference: externalReference, total_amount: totalAmount, ...extra } });
  return id;
}

export async function lerOrderFalsa(request: APIRequestContext, idOuPedido: string) {
  const r = await request.get(`${URL_MP_FALSO}/teste/order/${idOuPedido}`);
  return r.ok() ? ((await r.json()) as Record<string, unknown>) : null;
}

export async function aprovarOrder(request: APIRequestContext, id: string) {
  await request.post(`${URL_MP_FALSO}/teste/aprovar/${id}`);
}

export function notificacao(orderId: string, p: { segredo?: string; ts?: number; requestId?: string; corpo?: Record<string, unknown> } = {}) {
  const ts = String(p.ts ?? Date.now());
  const requestId = p.requestId ?? randomUUID();
  const v1 = createHmac('sha256', p.segredo ?? SEGREDO_WEBHOOK_FALSO).update(`id:${orderId.toLowerCase()};request-id:${requestId};ts:${ts};`).digest('hex');
  return {
    url: `/api/pagamentos/webhook?data.id=${encodeURIComponent(orderId)}&type=order`,
    headers: { 'x-signature': `ts=${ts},v1=${v1}`, 'x-request-id': requestId, 'content-type': 'application/json' },
    data: JSON.stringify(p.corpo ?? { action: 'order.processed', type: 'order', live_mode: false, data: { id: orderId } }),
  };
}
