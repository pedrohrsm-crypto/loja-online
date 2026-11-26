import { describe, expect, it } from 'vitest';
import { assinar, manifest, tsEmMs, verificarAssinatura } from './assinatura';

const SEGREDO = 'segredo-ficticio-de-teste';
const AGORA = 1_790_000_000_000;
const ORDER = 'ORD01M28P44G5FG8RJPM579EH56FV';
const REQ = '2066ca19-c6f1-498a-be75-1923005edd06';

function cabecalho(p: { ts?: string; dataId?: string | null; req?: string | null; segredo?: string } = {}) {
  const ts = p.ts ?? String(AGORA);
  const id = p.dataId === undefined ? ORDER.toLowerCase() : p.dataId;
  const v1 = assinar(manifest(id, p.req === undefined ? REQ : p.req, ts), p.segredo ?? SEGREDO);
  return `ts=${ts},v1=${v1}`;
}

const verificar = (xSignature: string | null, extra: Partial<Parameters<typeof verificarAssinatura>[0]> = {}) =>
  verificarAssinatura({ xSignature, xRequestId: REQ, dataId: ORDER, segredo: SEGREDO, agoraMs: AGORA, ...extra });

describe('assinatura do webhook do Mercado Pago (T10)', () => {
  it('manifest no formato da doc: id, request-id e ts, terminando em ;', () => {
    expect(manifest('ord1', 'req', '123')).toBe('id:ord1;request-id:req;ts:123;');
    expect(manifest(null, 'req', '123')).toBe('request-id:req;ts:123;');
    expect(manifest('ord1', null, '123')).toBe('id:ord1;ts:123;');
  });

  it('aceita a assinatura com o data.id em minúsculas (doc) e como chegou (SDK oficial)', () => {
    expect(verificar(cabecalho())).toEqual({ ok: true });
    expect(verificar(cabecalho({ dataId: ORDER }))).toEqual({ ok: true });
  });

  it('ts em milissegundos (doc da Orders API) e em segundos (SDK)', () => {
    expect(tsEmMs('1742505638683')).toBe(1742505638683);
    expect(tsEmMs('1704908010')).toBe(1704908010000);
    expect(verificar(cabecalho({ ts: String(AGORA / 1000) }))).toEqual({ ok: true });
  });

  it('v1 errado, segredo errado ou outro data.id → não confere', () => {
    expect(verificar(cabecalho({ segredo: 'outro' }))).toEqual({ ok: false, motivo: 'nao-confere' });
    expect(verificar(cabecalho(), { dataId: 'ORD-OUTRA' })).toEqual({ ok: false, motivo: 'nao-confere' });
    expect(verificar(cabecalho(), { xRequestId: 'outro-request' })).toEqual({ ok: false, motivo: 'nao-confere' });
    const bom = cabecalho();
    const trocado = bom.replace(/v1=(.)/, (_, c: string) => `v1=${c === '0' ? '1' : '0'}`);
    expect(verificar(trocado)).toEqual({ ok: false, motivo: 'nao-confere' });
  });

  it('velha ou do futuro além de 5 min → fora da tolerância, mesmo com HMAC certo', () => {
    expect(verificar(cabecalho({ ts: String(AGORA - 301_000) }))).toEqual({ ok: false, motivo: 'fora-da-tolerancia' });
    expect(verificar(cabecalho({ ts: String(AGORA + 301_000) }))).toEqual({ ok: false, motivo: 'fora-da-tolerancia' });
    expect(verificar(cabecalho({ ts: String(AGORA - 299_000) }))).toEqual({ ok: true });
  });

  it('sem cabeçalho ou malformado', () => {
    expect(verificar(null)).toEqual({ ok: false, motivo: 'sem-cabecalho' });
    expect(verificar('  ')).toEqual({ ok: false, motivo: 'sem-cabecalho' });
    expect(verificar('ts=123')).toEqual({ ok: false, motivo: 'malformado' });
    expect(verificar('v1=abc')).toEqual({ ok: false, motivo: 'malformado' });
    expect(verificar(`ts=abc,v1=${'a'.repeat(64)}`)).toEqual({ ok: false, motivo: 'malformado' });
    expect(verificar(`ts=${AGORA},v1=${'a'.repeat(63)}`)).toEqual({ ok: false, motivo: 'malformado' });
  });

  it('o corpo não entra no manifest: assinar não depende dele (por isso a decisão é pelo GET)', () => {
    expect(manifest(ORDER.toLowerCase(), REQ, '1').includes('status')).toBe(false);
  });
});
