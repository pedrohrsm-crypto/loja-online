// Leitura da order do Mercado Pago, sem confiar no formato (L3, L4). O que decide "pago" mora aqui.
//
// Status da order (https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/payment-management/status/order-status,
// conferido em 4-Nov-2026): `processed` + `accredited` é o pagamento creditado; `action_required` +
// `waiting_transfer` é o Pix esperando; `canceled`/`expired`, `failed` e `refunded` são finais sem dinheiro
// para nós. Qualquer outro par é "pendente": a reconciliação olha de novo, nada muda.
import { mpParaCentavos } from './valor';

export type PixDaOrder = { qrCode: string; qrCodeBase64: string | null; ticketUrl: string | null };

export type OrderMP = {
  id: string;
  status: string;
  statusDetail: string;
  externalReference: string | null;
  totalCentavos: number | null;
  pix: PixDaOrder | null;
};

export type SituacaoOrder = 'paga' | 'aguardando' | 'encerrada' | 'pendente';

const ID_ORDER = /^[A-Za-z0-9_-]{1,64}$/;

function texto(v: unknown, max: number): string | null {
  return typeof v === 'string' && v.length > 0 && v.length <= max ? v : null;
}

export function lerOrder(json: unknown): OrderMP | null {
  if (typeof json !== 'object' || json === null) return null;
  const o = json as Record<string, unknown>;
  const id = texto(o.id, 64);
  const status = texto(o.status, 40);
  if (!id || !ID_ORDER.test(id) || !status) return null;
  const pagamentos = (o.transactions as { payments?: unknown } | undefined)?.payments;
  let pix: PixDaOrder | null = null;
  if (Array.isArray(pagamentos)) {
    for (const p of pagamentos) {
      const m = (p as { payment_method?: Record<string, unknown> } | null)?.payment_method;
      const qr = texto(m?.qr_code, 2000);
      if (m?.id === 'pix' && qr) {
        pix = { qrCode: qr, qrCodeBase64: texto(m.qr_code_base64, 200000), ticketUrl: texto(m.ticket_url, 2000) };
        break;
      }
    }
  }
  return {
    id,
    status,
    statusDetail: texto(o.status_detail, 60) ?? '',
    externalReference: texto(o.external_reference, 64),
    totalCentavos: mpParaCentavos(o.total_amount),
    pix,
  };
}

export function situacaoDaOrder(o: Pick<OrderMP, 'status' | 'statusDetail'>): SituacaoOrder {
  if (o.status === 'processed' && o.statusDetail === 'accredited') return 'paga';
  if (o.status === 'action_required' && o.statusDetail === 'waiting_transfer') return 'aguardando';
  if (o.status === 'created') return 'aguardando';
  if (['canceled', 'failed', 'refunded', 'expired'].includes(o.status)) return 'encerrada';
  return 'pendente';
}

/** Pode cancelar no Mercado Pago: só `created` ou `action_required` (referência "Cancel order by ID"). */
export function podeCancelar(o: Pick<OrderMP, 'status'>): boolean {
  return o.status === 'created' || o.status === 'action_required';
}
