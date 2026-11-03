// Guarda das imagens ilustrativas (L4): um módulo só liga slug a arquivo e texto alternativo; cada entrada
// aponta para um arquivo que existe, leve (≤ 120 KB) e em WebP; slug sem imagem não quebra a tela.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { IMAGENS_PRODUTO, ROTULO_IMAGEM_ILUSTRATIVA, imagemDoProduto, type ImagemProduto } from './imagens';

const RAIZ = join(__dirname, '..', '..');
const LIMITE_BYTES = 120 * 1024;

// Confere cada entrada do mapa contra a pasta public/ de `raiz`; devolve a lista de problemas (vazia = ok).
function problemas(mapa: Readonly<Record<string, ImagemProduto>>, raiz: string): string[] {
  const saida: string[] = [];
  for (const [slug, { src, alt }] of Object.entries(mapa)) {
    if (src !== `/produtos/${slug}.webp`) saida.push(`${slug}: caminho ${src}`);
    if (alt.trim().split(/\s+/).length < 4 || /^(foto|imagem)\b/i.test(alt.trim())) saida.push(`${slug}: texto alternativo pobre`);
    const arquivo = join(raiz, 'public', src);
    if (!existsSync(arquivo)) {
      saida.push(`${slug}: arquivo ausente`);
      continue;
    }
    if (statSync(arquivo).size > LIMITE_BYTES) saida.push(`${slug}: ${statSync(arquivo).size} bytes`);
    if (!/^RIFF[\s\S]{4}WEBP$/.test(readFileSync(arquivo).subarray(0, 12).toString('latin1'))) saida.push(`${slug}: não é WebP`);
  }
  return saida;
}

describe('imagens dos produtos', () => {
  it('slug sem imagem devolve null, inclusive nomes herdados de Object (constructor, __proto__)', () => {
    for (const slug of ['nao-existe', 'constructor', '__proto__', 'toString', '']) expect(imagemDoProduto(slug)).toBeNull();
  });

  it('slug com imagem devolve o caminho e o texto alternativo', () => {
    const mapa: Record<string, ImagemProduto> = { 'sabonete-artesanal': { src: '/produtos/sabonete-artesanal.webp', alt: 'Duas barras de sabonete' } };
    expect(imagemDoProduto('sabonete-artesanal', mapa)).toEqual(mapa['sabonete-artesanal']);
    expect(imagemDoProduto('vela-aromatica', mapa)).toBeNull();
  });

  it('cada entrada tem arquivo WebP existente, de até 120 KB, no caminho do slug, e texto alternativo descritivo', () => {
    expect(problemas(IMAGENS_PRODUTO, RAIZ)).toEqual([]);
  });

  it('o verificador pega arquivo ausente, caminho errado e texto alternativo pobre (canário, vale com o mapa vazio)', () => {
    const canario: Record<string, ImagemProduto> = {
      'sabonete-artesanal': { src: '/produtos/sabonete-artesanal.webp', alt: 'Duas barras de sabonete verde sobre linho' },
      'vela-aromatica': { src: '/produtos/outro.webp', alt: 'Foto' },
    };
    const achados = problemas(canario, join(RAIZ, 'lib', 'loja', 'inexistente'));
    expect(achados).toContain('sabonete-artesanal: arquivo ausente');
    expect(achados).toContain('vela-aromatica: caminho /produtos/outro.webp');
    expect(achados).toContain('vela-aromatica: texto alternativo pobre');
  });

  it('todo slug do mapa está entre os produtos publicados do seed', () => {
    const seed = readFileSync(join(RAIZ, 'supabase/seed/catalogo.sql'), 'utf8');
    const publicados = [...seed.matchAll(/\('[a-z-]+',\s*'([a-z0-9-]+)',[\s\S]*?,\s*(true|false)\)/g)].filter((m) => m[2] === 'true').map((m) => m[1]);
    expect(publicados.length).toBe(12);
    expect(Object.keys(IMAGENS_PRODUTO).filter((slug) => !publicados.includes(slug))).toEqual([]);
  });

  it('a tela mostra a etiqueta "Imagem ilustrativa", usa next/image com sizes e pré-carrega só a imagem principal', () => {
    const vista = readFileSync(join(RAIZ, 'components/loja/produto-vista.tsx'), 'utf8');
    expect(ROTULO_IMAGEM_ILUSTRATIVA).toBe('Imagem ilustrativa');
    expect(vista).toMatch(/ROTULO_IMAGEM_ILUSTRATIVA/);
    expect(vista).toMatch(/<Image\b[^>]*sizes=/);
    expect(vista.match(/\bpreload\b/g)?.length).toBe(1);
    expect(vista).not.toMatch(/<img\b/);
  });
});
