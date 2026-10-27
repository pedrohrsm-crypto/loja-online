import { describe, expect, it } from 'vitest';
import { limparContexto, limparTexto } from './logger';

describe('logger sem dado pessoal', () => {
  it('troca e-mail, CPF e telefone dentro de qualquer texto', () => {
    const t = limparTexto('Key (email)=(ana@exemplo.com) já existe; cpf 123.456.789-09; fone (11) 91234-5678');
    expect(t).not.toMatch(/ana@exemplo\.com|123\.456\.789-09|91234-5678/);
    expect(t).toContain('[email]');
    expect(t).toContain('[cpf]');
    expect(t).toContain('[telefone]');
  });

  it('redige segredos pela chave, também aninhados', () => {
    const c = limparContexto({ token: 'abc', pedido: 'p1', cabecalhos: { authorization: 'Bearer x', rota: '/a' } });
    expect(c.token).toBe('[redigido]');
    expect(c.pedido).toBe('p1');
    expect(c.cabecalhos).toEqual({ authorization: '[redigido]', rota: '/a' });
  });

  it('corta texto longo', () => {
    expect(limparTexto('a'.repeat(900)).length).toBeLessThan(520);
  });
});
