'use server';

// Server Actions da vitrine (só leitura, nenhuma escrita): frete pelo CEP e conferência do carrinho
// contra o catálogo de hoje. A leitura é de lib/catalogo/; aqui só a validação da entrada e o
// formato serializável que volta para o navegador. O CEP não vai para o log.
import { lerFretePorCep, lerProdutoPorSlug } from '@/lib/catalogo/ler';
import type { FreteRegiao } from '@/lib/catalogo/tipos';
import type { SituacaoAtual } from './carrinho';
import { MENSAGEM_FRETE } from './frete-texto';

export type ResultadoFrete =
  | { ok: true; cep: string; opcoes: FreteRegiao[] }
  | { ok: false; mensagem: string };

export async function calcularFrete(cep: unknown): Promise<ResultadoFrete> {
  if (typeof cep !== 'string' || cep.length > 20) return { ok: false, mensagem: MENSAGEM_FRETE['cep-invalido'] };
  const r = await lerFretePorCep(cep);
  if (r.ok) return { ok: true, cep: r.cep, opcoes: r.opcoes };
  return { ok: false, mensagem: MENSAGEM_FRETE[r.motivo] };
}

export type ResultadoConferencia =
  | { ok: true; atuais: Record<string, SituacaoAtual> }
  | { ok: false };

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAXIMO_PRODUTOS_NO_CARRINHO = 20;

// Variação que não aparece em `atuais` saiu do ar (produto despublicado ou variação removida).
// Qualquer falha de leitura devolve { ok: false }: a tela mantém os itens e avisa, nunca finge que conferiu.
export async function conferirCarrinho(slugs: unknown): Promise<ResultadoConferencia> {
  if (!Array.isArray(slugs)) return { ok: false };
  const unicos = [...new Set(slugs.filter((s): s is string => typeof s === 'string' && SLUG.test(s)))].slice(0, MAXIMO_PRODUTOS_NO_CARRINHO);
  const leituras = await Promise.all(unicos.map((s) => lerProdutoPorSlug(s)));
  const atuais: Record<string, SituacaoAtual> = {};
  for (const l of leituras) {
    if (!l.ok) return { ok: false };
    for (const v of l.dados?.variacoes ?? []) atuais[v.id] = { precoCentavos: v.precoCentavos, estoque: v.estoque };
  }
  return { ok: true, atuais };
}
