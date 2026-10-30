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

function matiz(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (d === 0) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
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
  ['cor-borda', 'cor-superficie', 3],
  ['cor-primaria', 'cor-superficie', 3],
  ['cor-erro', 'cor-superficie', 4.5],
  ['cor-sucesso', 'cor-superficie', 4.5],
  // Ação destrutiva (estorno): texto sobre o preenchimento, e o contorno/texto sobre a página.
  ['cor-texto-no-perigo', 'cor-perigo', 4.5],
  ['cor-perigo', 'cor-fundo', 4.5],
  ['cor-perigo', 'cor-superficie', 4.5],
  // Aviso de atenção (preço mudou, pedido em confirmação).
  ['cor-atencao', 'cor-fundo', 4.5],
  ['cor-atencao', 'cor-superficie', 4.5],
  // QR do Pix: ponto escuro sobre fundo claro em todos os temas, senão o leitor não lê.
  ['cor-qr-ponto', 'cor-qr-fundo', 7],
];

describe('tokens de cor', () => {
  it('todo token do tema claro existe nos escuros, e vice-versa', () => {
    const nomes = (t: Record<string, string>) => Object.keys(t).sort();
    for (const tema of Object.values(TEMAS)) expect(nomes(tema)).toEqual(nomes(TEMAS.claro));
  });

  it('a ação destrutiva nunca tem a cor do primário de compra, em nenhum tema', () => {
    for (const tema of Object.values(TEMAS)) {
      expect(tema['cor-perigo']).not.toBe(tema['cor-primaria']);
      // Distintas também a olho: matiz a pelo menos 60 graus um do outro (luminância não basta: vermelho
      // e azul escuros têm quase a mesma).
      const d = Math.abs(matiz(tema['cor-perigo']) - matiz(tema['cor-primaria']));
      expect(Math.min(d, 360 - d)).toBeGreaterThanOrEqual(60);
    }
  });

  for (const [nome, tema] of Object.entries(TEMAS)) {
    it(`contraste mínimo no tema ${nome}`, () => {
      const falhas = PARES.filter(([a, b, min]) => contraste(tema[a], tema[b]) < min).map(([a, b, min]) => `${a} × ${b}: ${contraste(tema[a], tema[b]).toFixed(2)} < ${min}`);
      expect(falhas).toEqual([]);
    });
  }
});
