import { describe, expect, it, vi } from 'vitest';
import { escrever, linhasConferem } from './escrever';
import { ehColunaAusente } from './coluna-ausente';

vi.spyOn(console, 'error').mockImplementation(() => {});

describe('escrita conferida', () => {
  it('ok só com zero erro E as linhas esperadas', async () => {
    const r = await escrever(Promise.resolve({ data: [{ id: 1 }], error: null }), { esperado: 1, escopo: 't' });
    expect(r.ok).toBe(true);
  });

  it('0 linhas sem erro (a RLS barrou) é falha, não "salvo"', async () => {
    const r = await escrever(Promise.resolve({ data: [], error: null }), { esperado: 1, escopo: 't' });
    expect(r).toEqual({ ok: false, linhas: 0, erro: null });
  });

  it('erro do banco nunca é descartado', async () => {
    const r = await escrever(Promise.resolve({ data: null, error: { code: '42501', message: 'permissão negada' } }), { esperado: 1, escopo: 't' });
    expect(r.ok).toBe(false);
    expect(r.erro?.code).toBe('42501');
  });

  it('um-ou-mais aceita várias linhas e recusa zero', () => {
    expect(linhasConferem(3, 'um-ou-mais')).toBe(true);
    expect(linhasConferem(0, 'um-ou-mais')).toBe(false);
    expect(linhasConferem(2, 1)).toBe(false);
  });
});

describe('coluna ausente', () => {
  it('reconhece os dois códigos e nada mais', () => {
    expect(ehColunaAusente('42703')).toBe(true);
    expect(ehColunaAusente('PGRST204')).toBe(true);
    expect(ehColunaAusente('42501')).toBe(false);
    expect(ehColunaAusente(null)).toBe(false);
  });
});
