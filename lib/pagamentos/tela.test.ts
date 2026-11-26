import { describe, expect, it } from 'vitest';
import { montarTela, numeroDoPedido, type LinhaTela } from './tela';

const AGORA = Date.parse('2026-11-05T12:00:00Z');
const base: LinhaTela = {
  id: 'b0000000-0000-4000-8000-0000000004f2', status: 'aberto', total_centavos: 13400,
  expira_em: new Date(AGORA + 20 * 60_000).toISOString(), cancelado_em: null,
  mp_qr_code: '000201-copia', mp_qr_code_base64: 'aW1n', itens_pedido: [{ variacao_id: 'v1', quantidade: 2 }],
};

describe('tela do Pix a partir do pedido real (L3)', () => {
  it('aberto com Pix: aguardando, contagem pelo prazo do pedido, QR e itens', () => {
    expect(montarTela(base, AGORA)).toEqual({
      pedidoId: base.id, numero: 'B0000000', totalCentavos: 13400, situacao: 'aguardando', segundosRestantes: 1200,
      qrCode: '000201-copia', qrCodeBase64: 'aW1n', itens: [{ variacaoId: 'v1', quantidade: 2 }],
    });
  });

  it('aberto sem Pix: gerando', () => {
    expect(montarTela({ ...base, mp_qr_code: null, mp_qr_code_base64: null }, AGORA)?.situacao).toBe('gerando');
  });

  it('pedido fechado nunca mostra QR', () => {
    for (const status of ['pago', 'cancelado', 'estornado']) {
      const t = montarTela({ ...base, status }, AGORA);
      expect(t?.qrCode).toBeNull();
      expect(t?.qrCodeBase64).toBeNull();
    }
  });

  it('pago → pago; cancelado pelo prazo → expirado (com "Já pagou?"); cancelado antes → cancelado', () => {
    expect(montarTela({ ...base, status: 'pago' }, AGORA)?.situacao).toBe('pago');
    expect(montarTela({ ...base, status: 'cancelado', cancelado_em: new Date(AGORA + 26 * 60_000).toISOString() }, AGORA)?.situacao).toBe('expirado');
    expect(montarTela({ ...base, status: 'cancelado', cancelado_em: new Date(AGORA).toISOString() }, AGORA)?.situacao).toBe('cancelado');
    expect(montarTela({ ...base, status: 'estornado' }, AGORA)?.situacao).toBe('cancelado');
  });

  it('linha do starter (sem total ou prazo) não é tela de Pix', () => {
    expect(montarTela({ ...base, total_centavos: null }, AGORA)).toBeNull();
    expect(montarTela({ ...base, expira_em: null }, AGORA)).toBeNull();
  });

  it('número do pedido: os 8 primeiros caracteres, em maiúsculas', () => {
    expect(numeroDoPedido('b0000000-0000-4000-8000-0000000004f2')).toBe('B0000000');
  });
});
