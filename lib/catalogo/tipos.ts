// Tipos do catálogo como a vitrine os usa (camelCase). O banco é snake_case; a tradução
// mora em lib/catalogo/ler.ts e em nenhum outro lugar.

// Mesma lista do CHECK de fretes_regiao.modo (a guarda em frete.test.ts confere).
export const MODOS_FRETE = ['correios', 'motoboy', 'retirada'] as const;
export type ModoFrete = (typeof MODOS_FRETE)[number];

export type Categoria = {
  id: string;
  slug: string;
  nome: string;
  ordem: number;
};

export type Produto = {
  id: string;
  categoriaId: string;
  slug: string;
  nome: string;
  descricao: string;
  modoDeUso: string;
  // Lista de ingredientes, como a dona escreve.
  ingredientes: string;
  criadoEm: string;
  atualizadoEm: string;
};

export type Variacao = {
  id: string;
  produtoId: string;
  aroma: string;
  // Texto: "90 g", "140 g", "150 g", "300 g", "100 ml".
  tamanho: string;
  precoCentavos: number;
  estoque: number;
  sku: string;
};

export type ProdutoComVariacoes = Produto & {
  categoria: Pick<Categoria, 'slug' | 'nome'>;
  // Só as publicadas, da mais barata para a mais cara. Pode vir vazia.
  variacoes: Variacao[];
};

// Só as colunas do GRANT de anon (sem id e sem ativo): a região sai sempre do CEP.
export type FreteRegiao = {
  nome: string;
  cepInicio: string;
  cepFim: string;
  modo: ModoFrete;
  valorCentavos: number;
  prazoTexto: string;
};

// Falha de leitura: o detalhe vai para o log; a tela recebe só o motivo.
export type Leitura<T> = { ok: true; dados: T } | { ok: false; motivo: 'indisponivel' };

export type LeituraFrete =
  | { ok: true; cep: string; opcoes: FreteRegiao[] }
  | { ok: false; motivo: 'cep-invalido' | 'sem-frete' | 'indisponivel' };
