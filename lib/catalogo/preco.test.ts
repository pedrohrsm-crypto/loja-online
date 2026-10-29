import { describe, expect, it } from 'vitest';
import { ESPACO_INSEPARAVEL as E, estaEsgotada, formatarPreco, menorPreco } from './preco';

describe('formatarPreco', () => {
  it('preços aprovados na média fidelidade: 2200 → R$ 22,00; 3000 → R$ 30,00', () => {
    expect(formatarPreco(2200)).toBe(`R$${E}22,00`);
    expect(formatarPreco(3000)).toBe(`R$${E}30,00`);
  });

  it('centavos com dois dígitos, zero e milhar com ponto', () => {
    expect(formatarPreco(5)).toBe(`R$${E}0,05`);
    expect(formatarPreco(0)).toBe(`R$${E}0,00`);
    expect(formatarPreco(1234567)).toBe(`R$${E}12.345,67`);
    expect(formatarPreco(100000)).toBe(`R$${E}1.000,00`);
  });

  it('recusa valor que não é centavo inteiro e não negativo', () => {
    expect(() => formatarPreco(22.5)).toThrow(RangeError);
    expect(() => formatarPreco(-1)).toThrow(RangeError);
    expect(() => formatarPreco(Number.NaN)).toThrow(RangeError);
  });
});

describe('menorPreco e estaEsgotada', () => {
  it('"a partir de" é o menor preço; sem variação, null', () => {
    expect(menorPreco([{ precoCentavos: 3000 }, { precoCentavos: 2200 }])).toBe(2200);
    expect(menorPreco([])).toBeNull();
  });

  it('esgotada só com estoque zero', () => {
    expect(estaEsgotada({ estoque: 0 })).toBe(true);
    expect(estaEsgotada({ estoque: 1 })).toBe(false);
  });
});
