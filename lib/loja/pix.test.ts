import { describe, expect, it } from 'vitest';
import { formatarContagem, PRAZO_PIX_SEGUNDOS, segundosRestantes, situacaoExibida } from './pix';
import { LADO_QR, matrizQrExemplo } from './qr';

describe('contagem do Pix', () => {
  it('formata mm:ss e o prazo é de 30 minutos', () => {
    expect(formatarContagem(PRAZO_PIX_SEGUNDOS)).toBe('30:00');
    expect(formatarContagem(29 * 60 + 41)).toBe('29:41');
    expect(formatarContagem(5)).toBe('00:05');
    expect(formatarContagem(-3)).toBe('00:00');
  });

  it('segundos restantes arredondam para cima e nunca ficam negativos', () => {
    expect(segundosRestantes(10_500, 10_000)).toBe(1);
    expect(segundosRestantes(10_000, 10_000)).toBe(0);
    expect(segundosRestantes(5_000, 10_000)).toBe(0);
  });
});

describe('situação exibida', () => {
  it('aguardando vira expirado quando a contagem zera', () => {
    expect(situacaoExibida('aguardando', 10, false)).toBe('aguardando');
    expect(situacaoExibida('aguardando', 0, false)).toBe('expirado');
  });

  it('quem diz "já paguei" no expirado cai em confirmação, nunca de volta ao pagamento', () => {
    expect(situacaoExibida('expirado', 0, true)).toBe('em-confirmacao');
    expect(situacaoExibida('aguardando', 0, true)).toBe('em-confirmacao');
  });

  it('pago, cancelado e em confirmação do servidor não mudam', () => {
    expect(situacaoExibida('pago', 0, false)).toBe('pago');
    expect(situacaoExibida('cancelado', 0, true)).toBe('cancelado');
    expect(situacaoExibida('em-confirmacao', 0, false)).toBe('em-confirmacao');
  });
});

describe('QR de exemplo', () => {
  it('é quadrado, determinístico por pedido e traz os três marcadores de canto', () => {
    const a = matrizQrExemplo(1042);
    expect(a).toHaveLength(LADO_QR);
    expect(a.every((l) => l.length === LADO_QR)).toBe(true);
    expect(matrizQrExemplo(1042)).toEqual(a);
    expect(matrizQrExemplo(1043)).not.toEqual(a);
    for (const [l, c] of [[0, 0], [0, LADO_QR - 7], [LADO_QR - 7, 0]]) {
      expect(a[l][c]).toBe(true);
      expect(a[l + 3][c + 3]).toBe(true);
      expect(a[l + 1][c + 1]).toBe(false);
    }
  });
});
