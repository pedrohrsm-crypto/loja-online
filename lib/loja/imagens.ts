// Imagens ilustrativas dos produtos (frente identidade-visual, #25): o único lugar que liga slug a
// arquivo e a texto alternativo. As imagens são ilustrações geradas por IA, em public/produtos/, e a
// tela sempre as mostra com a etiqueta "Imagem ilustrativa". Slug sem entrada aqui continua mostrando o
// estado anterior ("Foto do produto em breve"), sem quebrar.
export type ImagemProduto = { src: string; alt: string };

// Proporção 16:10 (a mesma do espaço reservado), 1200 px de largura: o espaço existe antes da imagem
// carregar, então a página não muda de tamanho (sem layout shift).
export const LARGURA_IMAGEM = 1200;
export const ALTURA_IMAGEM = 750;
export const ROTULO_IMAGEM_ILUSTRATIVA = 'Imagem ilustrativa';

// slug -> imagem. Cada entrada exige o arquivo em public/produtos/<slug>.webp (guarda em imagens.test.ts).
export const IMAGENS_PRODUTO: Readonly<Record<string, ImagemProduto>> = {};

export function imagemDoProduto(slug: string, mapa: Readonly<Record<string, ImagemProduto>> = IMAGENS_PRODUTO): ImagemProduto | null {
  return Object.hasOwn(mapa, slug) ? mapa[slug] : null;
}
