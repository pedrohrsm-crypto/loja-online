import { describe, expect, it } from 'vitest';
import { centavosParaMP, mpParaCentavos } from './valor';

describe('valor em reais para o Mercado Pago (T17)', () => {
  it('R$ 85,00 × 3 + frete R$ 25,00 = "280.00"', () => {
    expect(centavosParaMP(85_00 * 3 + 25_00)).toBe('280.00');
  });

  it('centavos com zero à esquerda e valores pequenos', () => {
    expect(centavosParaMP(1)).toBe('0.01');
    expect(centavosParaMP(1005)).toBe('10.05');
    expect(centavosParaMP(11900)).toBe('119.00');
  });

  it('recusa zero, negativo, fração e NaN: valor errado nunca vira cobrança', () => {
    for (const v of [0, -100, 10.5, Number.NaN, Number.POSITIVE_INFINITY]) expect(() => centavosParaMP(v)).toThrow(RangeError);
  });

  it('lê o texto decimal do Mercado Pago sem float', () => {
    expect(mpParaCentavos('280.00')).toBe(28000);
    expect(mpParaCentavos('0.29')).toBe(29);
    expect(mpParaCentavos('85.5')).toBe(8550);
    expect(mpParaCentavos('85')).toBe(8500);
    // 0.1 + 0.2 em float daria 30.000000000000004 centavos; aqui é texto.
    expect(mpParaCentavos('0.30')).toBe(30);
  });

  it('formato fora do padrão é null, nunca um número parecido', () => {
    for (const v of ['85,00', '-85.00', '85.001', '', ' ', 'abc', '1e3', null, 85]) expect(mpParaCentavos(v)).toBeNull();
  });

  it('ida e volta batem', () => {
    for (const c of [1, 99, 100, 2200, 28000, 123456789]) expect(mpParaCentavos(centavosParaMP(c))).toBe(c);
  });
});
