import { describe, expect, it } from 'vitest';
import { lerOrder, podeCancelar, situacaoDaOrder } from './order';

// Resposta da doc "Realizar compra de teste com Pix" (Orders API, conferida em 4-Nov-2026), encurtada.
const CRIADA = {
  id: 'ORD01JP84C939T20S0P1DN382FQ6K', type: 'online', processing_mode: 'automatic', external_reference: 'ext_ref_1234',
  total_amount: '50.00', country_code: 'BRA', status: 'action_required', status_detail: 'waiting_transfer',
  transactions: { payments: [{ id: 'PAY01', amount: '50.00', status: 'action_required', status_detail: 'waiting_transfer',
    payment_method: { id: 'pix', type: 'bank_transfer', ticket_url: 'https://www.mercadopago.com.br/sandbox/payments/1/ticket', qr_code: '00020126580014br.gov.bcb.pix', qr_code_base64: '' } }] },
};

describe('order do Mercado Pago', () => {
  it('lê o Pix: copia e cola, imagem (vazia vira null) e link', () => {
    const o = lerOrder(CRIADA);
    expect(o).toMatchObject({ id: CRIADA.id, status: 'action_required', statusDetail: 'waiting_transfer', externalReference: 'ext_ref_1234', totalCentavos: 5000 });
    expect(o?.pix).toEqual({ qrCode: '00020126580014br.gov.bcb.pix', qrCodeBase64: null, ticketUrl: 'https://www.mercadopago.com.br/sandbox/payments/1/ticket' });
  });

  it('formato estranho é null (nunca "paga")', () => {
    for (const v of [null, 'x', {}, { id: 'ORD 1', status: 'processed' }, { id: 'ORD1' }, { id: 'a'.repeat(65), status: 'processed' }]) expect(lerOrder(v)).toBeNull();
  });

  it('só processed + accredited é paga', () => {
    expect(situacaoDaOrder({ status: 'processed', statusDetail: 'accredited' })).toBe('paga');
    expect(situacaoDaOrder({ status: 'processed', statusDetail: 'partially_refunded' })).toBe('pendente');
    expect(situacaoDaOrder({ status: 'action_required', statusDetail: 'waiting_transfer' })).toBe('aguardando');
    expect(situacaoDaOrder({ status: 'canceled', statusDetail: 'expired' })).toBe('encerrada');
    expect(situacaoDaOrder({ status: 'failed', statusDetail: 'expired' })).toBe('encerrada');
    expect(situacaoDaOrder({ status: 'processing', statusDetail: 'in_process' })).toBe('pendente');
    expect(situacaoDaOrder({ status: 'charged_back', statusDetail: 'in_process' })).toBe('pendente');
  });

  it('cancela só created e action_required', () => {
    expect(podeCancelar({ status: 'action_required' })).toBe(true);
    expect(podeCancelar({ status: 'created' })).toBe(true);
    expect(podeCancelar({ status: 'processed' })).toBe(false);
    expect(podeCancelar({ status: 'canceled' })).toBe(false);
  });
});
