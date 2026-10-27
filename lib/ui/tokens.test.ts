// Guarda de tokens (módulo Acessibilidade; 04, erro 6.2): todo token tem par em todos os temas,
// e os pares de uso têm o contraste mínimo em cada tema.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contraste } from './contraste';

const css = readFileSync(new URL('../../app/globals.css', import.meta.url), 'utf8');

function bloco(seletor: RegExp): Record<string, string> {
  const m = css.match(seletor);
  if (!m) throw new Error(`bloco não encontrado: ${seletor}`);
  return Object.fromEntries([...m[1].matchAll(/--(cor-[\w-]+):\s*(#[0-9a-f]{3,6})/gi)].map((x) => [x[1], x[2]]));
}

const TEMAS = {
  claro: bloco(/^:root\s*\{([^}]*)\}/m),
  'escuro (sistema)': bloco(/:root:not\(\[data-tema="claro"\]\)\s*\{([^}]*)\}/),
  'escuro (escolhido)': bloco(/:root\[data-tema="escuro"\]\s*\{([^}]*)\}/),
};

// [frente, fundo, mínimo]
const PARES: Array<[string, string, number]> = [
  ['cor-texto', 'cor-fundo', 4.5],
  ['cor-texto', 'cor-superficie', 4.5],
  ['cor-texto-suave', 'cor-fundo', 4.5],
  ['cor-texto-suave', 'cor-superficie', 4.5],
  ['cor-texto-na-primaria', 'cor-primaria', 4.5],
  ['cor-primaria', 'cor-fundo', 3],
  ['cor-erro', 'cor-fundo', 4.5],
  ['cor-sucesso', 'cor-fundo', 4.5],
  ['cor-foco', 'cor-fundo', 3],
  ['cor-foco', 'cor-superficie', 3],
  ['cor-borda', 'cor-fundo', 3],
];

describe('tokens de cor', () => {
  it('todo token do tema claro existe nos escuros, e vice-versa', () => {
    const nomes = (t: Record<string, string>) => Object.keys(t).sort();
    for (const tema of Object.values(TEMAS)) expect(nomes(tema)).toEqual(nomes(TEMAS.claro));
  });

  for (const [nome, tema] of Object.entries(TEMAS)) {
    it(`contraste mínimo no tema ${nome}`, () => {
      const falhas = PARES.filter(([a, b, min]) => contraste(tema[a], tema[b]) < min).map(([a, b, min]) => `${a} × ${b}: ${contraste(tema[a], tema[b]).toFixed(2)} < ${min}`);
      expect(falhas).toEqual([]);
    });
  }
});
