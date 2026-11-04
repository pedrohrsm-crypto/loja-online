import { describe, expect, it } from 'vitest';
import { lerConfigMP } from './config';

const COMPLETO = { PAGAMENTO_MODO: 'teste', MERCADOPAGO_ACCESS_TOKEN: 'APP_USR-ficticio', MERCADOPAGO_WEBHOOK_SECRET: 'segredo-ficticio' };

describe('configuração do Mercado Pago (L1)', () => {
  it('completa: devolve o modo explícito', () => {
    expect(lerConfigMP(COMPLETO)).toEqual({ ok: true, config: { modo: 'teste', accessToken: 'APP_USR-ficticio', segredoWebhook: 'segredo-ficticio' } });
    expect(lerConfigMP({ ...COMPLETO, PAGAMENTO_MODO: 'producao' })).toMatchObject({ ok: true, config: { modo: 'producao' } });
  });

  it('o modo não se deduz da credencial: sem PAGAMENTO_MODO, recusa mesmo com o token', () => {
    expect(lerConfigMP({ ...COMPLETO, PAGAMENTO_MODO: undefined })).toEqual({ ok: false, faltando: ['PAGAMENTO_MODO'] });
  });

  it('modo com outro valor (live, prod, Teste) recusa', () => {
    for (const m of ['live', 'prod', 'Teste', 'test', '']) expect(lerConfigMP({ ...COMPLETO, PAGAMENTO_MODO: m }).ok).toBe(false);
  });

  it('variável faltando ou em branco recusa e diz qual', () => {
    expect(lerConfigMP({})).toEqual({ ok: false, faltando: ['PAGAMENTO_MODO', 'MERCADOPAGO_ACCESS_TOKEN', 'MERCADOPAGO_WEBHOOK_SECRET'] });
    expect(lerConfigMP({ ...COMPLETO, MERCADOPAGO_WEBHOOK_SECRET: '  ' })).toEqual({ ok: false, faltando: ['MERCADOPAGO_WEBHOOK_SECRET'] });
  });
});
