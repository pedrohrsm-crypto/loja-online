import { describe, expect, it } from 'vitest';
import { formatarCepNoBlur, textoValorFrete } from './frete-texto';

describe('texto do frete', () => {
  it('formata o CEP ao sair do campo e devolve o que não é CEP sem mexer (só aparando)', () => {
    expect(formatarCepNoBlur('01310100')).toBe('01310-100');
    expect(formatarCepNoBlur(' 01310-100 ')).toBe('01310-100');
    expect(formatarCepNoBlur('0131')).toBe('0131');
    expect(formatarCepNoBlur('abc ')).toBe('abc');
  });

  it('frete zero é "Grátis" (retirada); o resto é preço', () => {
    expect(textoValorFrete(0)).toBe('Grátis');
    expect(textoValorFrete(3000)).toMatch(/30,00$/);
  });
});
