// Regras do carrinho do navegador (L3). Puras: o armazenamento (localStorage) mora em
// lib/loja/carrinho-armazenamento.ts, e a conferência com o catálogo, em lib/loja/acoes.ts.
export const QUANTIDADE_MAXIMA = 10;

export type ItemCarrinho = {
  variacaoId: string;
  slug: string;
  nome: string;
  aroma: string;
  tamanho: string;
  precoCentavos: number;
  quantidade: number;
};

// O que o catálogo diz hoje sobre a variação do item. `undefined` = a variação saiu do ar.
export type SituacaoAtual = { precoCentavos: number; estoque: number };

export type Situacao =
  | { tipo: 'ok' }
  | { tipo: 'esgotado' }
  // Pode vir junto com preço que mudou: os dois avisos aparecem, e a conta usa o preço de hoje.
  | { tipo: 'acima-do-estoque'; disponivel: number; precoAntesCentavos?: number; precoAgoraCentavos?: number }
  | { tipo: 'indisponivel' }
  | { tipo: 'preco-mudou'; precoAntesCentavos: number; precoAgoraCentavos: number };

// Quantas unidades do item o comprador pode levar: o estoque, até o teto por item (FIDELIDADE.md §1,
// regra 3). Única regra do teto: carrinho, produto e conferência chamam esta função.
export function tetoDoItem(estoque: number): number {
  const e = Math.trunc(estoque);
  return Number.isFinite(e) ? Math.max(0, Math.min(e, QUANTIDADE_MAXIMA)) : 0;
}

export function limitarQuantidade(quantidade: number, estoque: number = QUANTIDADE_MAXIMA): number {
  const n = Math.trunc(quantidade);
  if (!Number.isFinite(n)) return 1;
  return Math.min(Math.max(n, 1), Math.max(1, tetoDoItem(estoque)));
}

export function adicionar(itens: readonly ItemCarrinho[], novo: Omit<ItemCarrinho, 'quantidade'>, estoque: number): ItemCarrinho[] {
  const existente = itens.find((i) => i.variacaoId === novo.variacaoId);
  if (!existente) return [...itens, { ...novo, quantidade: 1 }];
  return itens.map((i) =>
    i.variacaoId === novo.variacaoId ? { ...i, precoCentavos: novo.precoCentavos, quantidade: limitarQuantidade(i.quantidade + 1, estoque) } : i,
  );
}

export function definirQuantidade(itens: readonly ItemCarrinho[], variacaoId: string, quantidade: number, estoque?: number): ItemCarrinho[] {
  return itens.map((i) => (i.variacaoId === variacaoId ? { ...i, quantidade: limitarQuantidade(quantidade, estoque) } : i));
}

export function remover(itens: readonly ItemCarrinho[], variacaoId: string): ItemCarrinho[] {
  return itens.filter((i) => i.variacaoId !== variacaoId);
}

// O que a linha realmente vale hoje: quantidade limitada ao disponível, pelo preço ATUAL (quando o
// catálogo foi conferido). Linha, subtotal e contagem de itens leem daqui: os números sempre batem.
export function linhaEfetiva(item: ItemCarrinho, atual?: SituacaoAtual): { quantidade: number; precoCentavos: number } {
  if (!atual) return { quantidade: item.quantidade, precoCentavos: item.precoCentavos };
  return { quantidade: Math.min(item.quantidade, tetoDoItem(atual.estoque)), precoCentavos: atual.precoCentavos };
}

function compravel(atuais: Readonly<Record<string, SituacaoAtual>> | undefined, i: ItemCarrinho): boolean {
  if (!atuais) return true;
  const atual = atuais[i.variacaoId];
  return Boolean(atual) && atual.estoque > 0;
}

// Unidades que entram na conta ("Subtotal (7 itens)"): as mesmas do subtotal.
export function contarUnidades(itens: readonly ItemCarrinho[], atuais?: Readonly<Record<string, SituacaoAtual>>): number {
  return itens.reduce((soma, i) => (compravel(atuais, i) ? soma + linhaEfetiva(i, atuais?.[i.variacaoId]).quantidade : soma), 0);
}

export function situacaoDoItem(item: ItemCarrinho, atual: SituacaoAtual | undefined): Situacao {
  if (!atual) return { tipo: 'indisponivel' };
  if (atual.estoque <= 0) return { tipo: 'esgotado' };
  const mudou = atual.precoCentavos !== item.precoCentavos;
  if (item.quantidade > tetoDoItem(atual.estoque)) {
    const base = { tipo: 'acima-do-estoque' as const, disponivel: tetoDoItem(atual.estoque) };
    return mudou ? { ...base, precoAntesCentavos: item.precoCentavos, precoAgoraCentavos: atual.precoCentavos } : base;
  }
  if (mudou) {
    return { tipo: 'preco-mudou', precoAntesCentavos: item.precoCentavos, precoAgoraCentavos: atual.precoCentavos };
  }
  return { tipo: 'ok' };
}

// Subtotal dos itens que podem ser comprados, pelo preço de HOJE quando o catálogo foi conferido.
// Item esgotado ou fora do ar não entra na conta.
export function subtotalCentavos(itens: readonly ItemCarrinho[], atuais?: Readonly<Record<string, SituacaoAtual>>): number {
  let total = 0;
  for (const i of itens) {
    if (!compravel(atuais, i)) continue;
    // Nunca conta mais que o disponível, pelo preço de hoje: o checkout confere o mesmo teto.
    const { quantidade, precoCentavos } = linhaEfetiva(i, atuais?.[i.variacaoId]);
    total += precoCentavos * quantidade;
  }
  return total;
}

// "Continuar com o que está disponível": tira esgotados e fora do ar, aceita os preços novos.
export function continuarComDisponiveis(itens: readonly ItemCarrinho[], atuais: Readonly<Record<string, SituacaoAtual>>): ItemCarrinho[] {
  const saida: ItemCarrinho[] = [];
  for (const i of itens) {
    const atual = atuais[i.variacaoId];
    if (!atual || atual.estoque <= 0) continue;
    saida.push({ ...i, precoCentavos: atual.precoCentavos, quantidade: limitarQuantidade(i.quantidade, atual.estoque) });
  }
  return saida;
}

// Lê o texto do localStorage sem confiar nele: qualquer coisa fora do formato vira carrinho vazio
// (e o item inválido sai), nunca uma exceção na tela.
export function lerCarrinhoSeguro(texto: string | null): ItemCarrinho[] {
  if (!texto) return [];
  let bruto: unknown;
  try {
    bruto = JSON.parse(texto);
  } catch {
    return [];
  }
  if (!Array.isArray(bruto)) return [];
  const itens: ItemCarrinho[] = [];
  for (const x of bruto) {
    if (typeof x !== 'object' || x === null) continue;
    const o = x as Record<string, unknown>;
    if (
      typeof o.variacaoId === 'string' && typeof o.slug === 'string' && typeof o.nome === 'string' &&
      typeof o.aroma === 'string' && typeof o.tamanho === 'string' &&
      typeof o.precoCentavos === 'number' && Number.isSafeInteger(o.precoCentavos) && o.precoCentavos >= 0 &&
      typeof o.quantidade === 'number' && Number.isFinite(o.quantidade) &&
      !itens.some((i) => i.variacaoId === o.variacaoId)
    ) {
      itens.push({
        variacaoId: o.variacaoId, slug: o.slug, nome: o.nome, aroma: o.aroma, tamanho: o.tamanho,
        precoCentavos: o.precoCentavos, quantidade: limitarQuantidade(o.quantidade),
      });
    }
  }
  return itens;
}
