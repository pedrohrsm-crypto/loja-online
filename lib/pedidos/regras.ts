// Regras puras do pedido (#27): o teto por item, a soma, o total e a conferência da entrada do
// checkout (FIDELIDADE.md §1, regra 3). Um lugar só: o carrinho, o produto, a tela de entrega e o
// servidor importam daqui. O banco NÃO recalcula: confere sob trava o estoque, o preço de hoje e a
// publicação, e recusa total que não bata com os itens (migration 20261103000001).
import { normalizarCep } from '@/lib/catalogo/frete';
import { MENSAGEM_FRETE } from '@/lib/loja/frete-texto';
import { MODOS_FRETE, type FreteRegiao, type ModoFrete } from '@/lib/catalogo/tipos';

// Teto por item (unidades da mesma variação num pedido).
export const QUANTIDADE_MAXIMA = 10;
// Variações diferentes num pedido.
export const MAXIMO_ITENS_NO_PEDIDO = 20;
export const MAXIMO_ENDERECO = 200;
export const MAXIMO_NOME = 120;

// Quantas unidades do item o comprador pode levar: o estoque, até o teto por item. Única regra do
// teto: carrinho, produto e servidor chamam esta função.
export function tetoDoItem(estoque: number): number {
  const e = Math.trunc(estoque);
  return Number.isFinite(e) ? Math.max(0, Math.min(e, QUANTIDADE_MAXIMA)) : 0;
}

// Quantidade que a entrada do checkout aceita: inteiro de 1 ao teto. O "até o disponível" é o
// banco que confere, sob trava, porque só ele sabe o estoque no instante da reserva.
export function quantidadeAceita(quantidade: unknown): quantidade is number {
  return typeof quantidade === 'number' && Number.isInteger(quantidade) && quantidade >= 1 && quantidade <= QUANTIDADE_MAXIMA;
}

// Soma das linhas (quantidade × preço). O subtotal do carrinho e o do pedido saem daqui.
export function somaDasLinhas(linhas: readonly { quantidade: number; precoCentavos: number }[]): number {
  return linhas.reduce((soma, l) => soma + l.quantidade * l.precoCentavos, 0);
}

// Total = subtotal + frete. Frete 0 (retirada) é valor, não ausência: quem ainda não tem frete
// escolhido passa `null` e o total fica só o subtotal (04, 8.4: zero ≠ sem dado).
export function totalDoPedido(subtotalCentavos: number, freteCentavos: number | null): number {
  return subtotalCentavos + (freteCentavos ?? 0);
}

// "(11) 90000-0000", "11900000000" ou "+55 11 90000-0000" → "11900000000". DDD + 8 ou 9 dígitos.
export function normalizarTelefone(entrada: string): string | null {
  let d = entrada.replace(/\D/g, '');
  if (d.length >= 12 && d.startsWith('55')) d = d.slice(2);
  return /^[1-9]{2}\d{8,9}$/.test(d) ? d : null;
}

export function exigeEndereco(modo: ModoFrete): boolean {
  return modo !== 'retirada';
}

export type ItemEntrada = { variacaoId: string; quantidade: number; precoCentavos: number };

export type EntradaPedido = {
  itens: ItemEntrada[];
  cep: string;
  modo: ModoFrete;
  telefone: string;
  nome: string | null;
  endereco: string | null;
};

export type CampoPedido = 'itens' | 'cep' | 'modo' | 'telefone' | 'nome' | 'endereco';

export const MENSAGEM_CAMPO: Record<CampoPedido, string> = {
  itens: 'Seu carrinho mudou ou está vazio. Volte ao carrinho e confira os itens.',
  cep: MENSAGEM_FRETE['cep-invalido'],
  modo: 'Escolha como quer receber.',
  telefone: 'Digite o WhatsApp com DDD. Exemplo: (11) 90000-0000.',
  nome: 'Digite o nome de quem vai receber.',
  endereco: 'Digite rua, número e complemento.',
};

export type Conferencia =
  | { ok: true; entrada: EntradaPedido }
  | { ok: false; erros: Partial<Record<CampoPedido, string>> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function texto(valor: unknown, maximo: number): string | null {
  if (typeof valor !== 'string') return null;
  const t = valor.trim().replace(/\s+/g, ' ');
  return t.length >= 1 && t.length <= maximo ? t : null;
}

function itensDaEntrada(bruto: unknown): ItemEntrada[] | null {
  if (!Array.isArray(bruto) || bruto.length < 1 || bruto.length > MAXIMO_ITENS_NO_PEDIDO) return null;
  const itens: ItemEntrada[] = [];
  for (const x of bruto) {
    if (typeof x !== 'object' || x === null) return null;
    const o = x as Record<string, unknown>;
    if (typeof o.variacaoId !== 'string' || !UUID.test(o.variacaoId)) return null;
    if (!quantidadeAceita(o.quantidade)) return null;
    if (typeof o.precoCentavos !== 'number' || !Number.isSafeInteger(o.precoCentavos) || o.precoCentavos < 1) return null;
    if (itens.some((i) => i.variacaoId === o.variacaoId)) return null;
    // Só os três campos: qualquer outro que venha do navegador (frete, total, id de região) fica de fora.
    itens.push({ variacaoId: o.variacaoId.toLowerCase(), quantidade: o.quantidade, precoCentavos: o.precoCentavos });
  }
  return itens;
}

// Confere a entrada que chega do navegador, sem confiar em nada dela. Campos que não estão aqui
// (valor do frete, id da região, total, usuário) são ignorados: o servidor deriva cada um.
export function conferirEntrada(bruto: unknown): Conferencia {
  const o = typeof bruto === 'object' && bruto !== null ? (bruto as Record<string, unknown>) : {};
  const erros: Partial<Record<CampoPedido, string>> = {};

  const itens = itensDaEntrada(o.itens);
  if (!itens) erros.itens = MENSAGEM_CAMPO.itens;

  const cep = typeof o.cep === 'string' && o.cep.length <= 20 ? normalizarCep(o.cep) : null;
  if (!cep) erros.cep = MENSAGEM_CAMPO.cep;

  const modo = (MODOS_FRETE as readonly unknown[]).includes(o.modo) ? (o.modo as ModoFrete) : null;
  if (!modo) erros.modo = MENSAGEM_CAMPO.modo;

  const telefone = typeof o.telefone === 'string' && o.telefone.length <= 30 ? normalizarTelefone(o.telefone) : null;
  if (!telefone) erros.telefone = MENSAGEM_CAMPO.telefone;

  let nome: string | null = null;
  let endereco: string | null = null;
  if (modo && exigeEndereco(modo)) {
    nome = texto(o.nome, MAXIMO_NOME);
    if (!nome) erros.nome = MENSAGEM_CAMPO.nome;
    endereco = texto(o.endereco, MAXIMO_ENDERECO);
    if (!endereco) erros.endereco = MENSAGEM_CAMPO.endereco;
  }

  if (!itens || !cep || !modo || !telefone || Object.keys(erros).length > 0) return { ok: false, erros };
  return { ok: true, entrada: { itens, cep, modo, telefone, nome, endereco } };
}

export type PedidoMontado = {
  itens: ItemEntrada[];
  cep: string;
  modo: ModoFrete;
  frete: Pick<FreteRegiao, 'nome' | 'prazoTexto' | 'valorCentavos'>;
  subtotalCentavos: number;
  totalCentavos: number;
  telefone: string;
  nome: string | null;
  endereco: string | null;
};

// Monta o pedido a congelar. `opcoes` são as faixas que valem PARA O CEP DA ENTRADA (lidas no
// servidor com lib/catalogo/ler.ts): o modo escolhido só vale se estiver entre elas, então
// motoboy e retirada fora da faixa do ateliê são recusados (regra 3, T17d).
export function montarPedido(entrada: EntradaPedido, opcoes: readonly FreteRegiao[]): { ok: true; pedido: PedidoMontado } | { ok: false; motivo: 'modo-fora-da-faixa' | 'total-invalido' } {
  const frete = opcoes.find((o) => o.modo === entrada.modo && o.cepInicio <= entrada.cep && entrada.cep <= o.cepFim);
  if (!frete) return { ok: false, motivo: 'modo-fora-da-faixa' };
  const subtotalCentavos = somaDasLinhas(entrada.itens);
  const totalCentavos = totalDoPedido(subtotalCentavos, frete.valorCentavos);
  if (!Number.isSafeInteger(totalCentavos) || subtotalCentavos <= 0 || totalCentavos <= 0) return { ok: false, motivo: 'total-invalido' };
  return {
    ok: true,
    pedido: {
      itens: entrada.itens, cep: entrada.cep, modo: entrada.modo,
      frete: { nome: frete.nome, prazoTexto: frete.prazoTexto, valorCentavos: frete.valorCentavos },
      subtotalCentavos, totalCentavos, telefone: entrada.telefone, nome: entrada.nome, endereco: entrada.endereco,
    },
  };
}
