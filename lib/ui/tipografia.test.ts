// Guarda de tipografia (L2): fonte auto-hospedada pelo next/font, com display 'swap', e nunca um
// <link> ou @import para o Google Fonts (o navegador não pode pedir nada a terceiros).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const RAIZ = join(__dirname, '..', '..');
const layout = readFileSync(join(RAIZ, 'app/layout.tsx'), 'utf8');

function fontes(pasta: string): Array<{ arquivo: string; texto: string }> {
  const saida: Array<{ arquivo: string; texto: string }> = [];
  const andar = (p: string) => {
    if (statSync(p).isDirectory()) readdirSync(p).forEach((f) => andar(join(p, f)));
    else if (/\.(tsx?|css)$/.test(p) && !/\.test\.ts$/.test(p)) saida.push({ arquivo: p, texto: readFileSync(p, 'utf8') });
  };
  andar(join(RAIZ, pasta));
  return saida;
}

describe('tipografia', () => {
  it('toda fonte do layout vem de next/font/google com display swap e variável CSS', () => {
    const chamadas = [...layout.matchAll(/=\s*(?:Fraunces|Inter)\(\{([^}]*)\}\)/g)].map((m) => m[1]);
    expect(chamadas.length).toBeGreaterThanOrEqual(2);
    for (const c of chamadas) {
      expect(c).toMatch(/display:\s*'swap'/);
      expect(c).toMatch(/variable:\s*'--fonte-/);
      expect(c).toMatch(/weight:\s*\[/);
    }
  });

  it('nenhum arquivo pede fonte ao Google pelo navegador', () => {
    const achados = [...fontes('app'), ...fontes('components')].filter((f) => /fonts\.(googleapis|gstatic)\.com/.test(f.texto)).map((f) => f.arquivo);
    expect(achados).toEqual([]);
  });

  it('o CSS usa a fonte de títulos nos h1 a h3', () => {
    const css = readFileSync(join(RAIZ, 'app/globals.css'), 'utf8');
    expect(css).toMatch(/h1,\s*h2,\s*h3\s*\{[^}]*font-family:\s*var\(--font-titulo\)/);
  });
});
