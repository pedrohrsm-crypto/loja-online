// Guarda das imagens ilustrativas (L4): um módulo só liga slug a arquivo e texto alternativo; cada entrada
// aponta para um arquivo que existe, leve (≤ 120 KB) e em WebP; slug sem imagem não quebra a tela.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { IMAGENS_PRODUTO, ROTULO_IMAGEM_ILUSTRATIVA, imagemDoProduto, type ImagemProduto } from './imagens';

const RAIZ = join(__dirname, '..', '..');
const LIMITE_BYTES = 120 * 1024;

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
    const problemas: string[] = [];
    for (const [slug, { src, alt }] of Object.entries(IMAGENS_PRODUTO)) {
      if (src !== `/produtos/${slug}.webp`) problemas.push(`${slug}: caminho ${src}`);
      const arquivo = join(RAIZ, 'public', src);
      if (!existsSync(arquivo)) {
        problemas.push(`${slug}: arquivo ausente`);
        continue;
      }
      if (statSync(arquivo).size > LIMITE_BYTES) problemas.push(`${slug}: ${statSync(arquivo).size} bytes`);
      const cabeca = readFileSync(arquivo).subarray(0, 12).toString('latin1');
      if (!/^RIFF[\s\S]{4}WEBP$/.test(cabeca)) problemas.push(`${slug}: não é WebP`);
      if (alt.trim().split(/\s+/).length < 4 || /^(foto|imagem)\b/i.test(alt.trim())) problemas.push(`${slug}: texto alternativo pobre`);
    }
    expect(problemas).toEqual([]);
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
