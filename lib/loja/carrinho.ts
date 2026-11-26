// Regras do carrinho do navegador (L3). Puras: o armazenamento (localStorage) mora em
// lib/loja/carrinho-armazenamento.ts, e a conferência com o catálogo, em lib/loja/acoes.ts.
// O teto por item e a soma moram em lib/pedidos/regras.ts: o checkout no servidor usa os mesmos.
import { QUANTIDADE_MAXIMA, somaDasLinhas, tetoDoItem } from '@/lib/pedidos/regras';

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
  // Nunca conta mais que o disponível, pelo preço de hoje: o checkout confere o mesmo teto.
  return somaDasLinhas(itens.filter((i) => compravel(atuais, i)).map((i) => linhaEfetiva(i, atuais?.[i.variacaoId])));
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

// Pagamento confirmado (L6, decisão do PM em 4-Nov): o carrinho esvazia. Tira do carrinho o que o
// pedido PAGO levou, variação por variação: no caso comum (o carrinho é o do pedido) sobra vazio; se o
// comprador montou outro carrinho depois de gerar o Pix (T18), o que é do pedido novo continua lá.
export function tirarItensPagos(itens: readonly ItemCarrinho[], pagos: readonly { variacaoId: string; quantidade: number }[]): ItemCarrinho[] {
  const saida: ItemCarrinho[] = [];
  for (const i of itens) {
    const pago = pagos.find((p) => p.variacaoId === i.variacaoId)?.quantidade ?? 0;
    const resta = i.quantidade - pago;
    if (resta > 0) saida.push({ ...i, quantidade: resta });
  }
  return saida;
}

// A reserva do próprio comprador já saiu do estoque que a vitrine mostra (#27): sem devolvê-la à conta,
// o carrinho dele marcava "Esgotado" o item que ele mesmo reservou (L6). Soma de volta, só para ele, o
// que o pedido aberto dele reserva, como a função criar_pedido faz ao substituir o pedido.
export function somarReservaPropria(
  atuais: Readonly<Record<string, SituacaoAtual>>,
  reservados: readonly { variacaoId: string; quantidade: number }[],
): Record<string, SituacaoAtual> {
  const saida: Record<string, SituacaoAtual> = { ...atuais };
  for (const r of reservados) {
    const a = saida[r.variacaoId];
    if (a && Number.isSafeInteger(r.quantidade) && r.quantidade > 0) saida[r.variacaoId] = { ...a, estoque: a.estoque + r.quantidade };
  }
  return saida;
}
