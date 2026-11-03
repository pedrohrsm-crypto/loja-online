// Guarda do wordmark (L3): SVG inline acessível (aria-label e <title>), cor só por currentColor/token,
// e o link do cabeçalho continua com alvo de 44 px.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const RAIZ = join(__dirname, '..', '..');
const marca = readFileSync(join(RAIZ, 'components/marca.tsx'), 'utf8');
const cabecalho = readFileSync(join(RAIZ, 'components/cabecalho.tsx'), 'utf8');

describe('wordmark', () => {
  it('o raminho é SVG inline com role img, aria-label e <title>', () => {
    const svg = marca.match(/<svg\b[^>]*>\s*<title>[^<]+<\/title>/);
    expect(svg).not.toBeNull();
    expect(svg?.[0]).toMatch(/role="img"/);
    expect(svg?.[0]).toMatch(/aria-label="[^"]+"/);
  });

  it('a cor vem de currentColor e do token, nunca de fill ou stroke literal', () => {
    expect(marca).toMatch(/fill="currentColor"/);
    expect(marca).toMatch(/text-primaria/);
    expect(marca.match(/\b(?:fill|stroke)="([^"]+)"/g)?.every((a) => /currentColor|none/.test(a))).toBe(true);
  });

  it('o nome do conjunto é o rótulo da imagem (uma leitura só) e o link do cabeçalho tem 44 px', () => {
    expect(marca).toMatch(/role="img" aria-label=\{nome\}/);
    expect(cabecalho).toMatch(/<Marca\b/);
    expect(cabecalho.match(/<Link href=\{admin \? '\/admin\/pedidos' : '\/'\}[^>]*>/)?.[0]).toMatch(/min-h-11/);
  });
});
