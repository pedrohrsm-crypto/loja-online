// Leitura do catálogo publicado e do frete por CEP. Só leitura: a escrita da dona é de
// outra frente (Server Actions com guarda de papel).
//
// Regras: nunca descartar `error` (vai para o log, e a tela recebe { ok: false });
// toda lista com `limit` e ordem explícitos (o PostgREST corta em 1.000 sem erro);
// filtro de `publicado` aqui também, além da RLS, para um cliente com service_role
// passado por engano não mostrar rascunho na vitrine. Com o schema antigo (migration
// ainda não aplicada) a leitura falha com erro do banco e volta 'indisponivel', sem 500.
import type { SupabaseClient } from '@supabase/supabase-js';
import { log } from '@/lib/observabilidade/logger';
import { clientePublico } from '@/lib/supabase/publico';
import { escolherFretes, normalizarCep } from './frete';
import type { Categoria, FreteRegiao, Leitura, LeituraFrete, ModoFrete, ProdutoComVariacoes, Variacao } from './tipos';

export const LIMITE_MAXIMO_PRODUTOS = 100;
export const LIMITE_VARIACOES_POR_PRODUTO = 50;
export const LIMITE_CATEGORIAS = 50;
export const LIMITE_FAIXAS_FRETE = 50;

// Colunas pedidas pelo nome: `*` em fretes_regiao falha para anon (id e ativo fora do GRANT).
const COLUNAS_VARIACAO = 'id, produto_id, aroma, tamanho, preco_centavos, estoque, sku';
const COLUNAS_PRODUTO = `id, categoria_id, slug, nome, descricao, modo_de_uso, ingredientes, criado_em, atualizado_em, categorias!inner(slug, nome), variacoes(${COLUNAS_VARIACAO})`;
const COLUNAS_FRETE = 'nome, cep_inicio, cep_fim, modo, valor_centavos, prazo_texto';
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

type ErroBanco = { code?: string; message: string; hint?: string | null };
type LinhaVariacao = { id: string; produto_id: string; aroma: string; tamanho: string; preco_centavos: number; estoque: number; sku: string };
type LinhaProduto = {
  id: string; categoria_id: string; slug: string; nome: string; descricao: string; modo_de_uso: string; ingredientes: string;
  criado_em: string; atualizado_em: string; categorias: { slug: string; nome: string }; variacoes: LinhaVariacao[] | null;
};
type LinhaFrete = { nome: string; cep_inicio: string; cep_fim: string; modo: ModoFrete; valor_centavos: number; prazo_texto: string };

function falhou(escopo: string, error: ErroBanco): { ok: false; motivo: 'indisponivel' } {
  log.error(escopo, 'leitura falhou', { codigo: error.code, erro: error.message, dica: error.hint });
  return { ok: false, motivo: 'indisponivel' };
}

// Inteiro entre 1 e o teto; o chamador não consegue pedir "tudo".
export function limitar(limite: number, teto: number): number {
  const n = Math.trunc(limite);
  return Number.isFinite(n) ? Math.min(Math.max(n, 1), teto) : 1;
}

function paraVariacao(v: LinhaVariacao): Variacao {
  return { id: v.id, produtoId: v.produto_id, aroma: v.aroma, tamanho: v.tamanho, precoCentavos: v.preco_centavos, estoque: v.estoque, sku: v.sku };
}

function paraProduto(p: LinhaProduto): ProdutoComVariacoes {
  return {
    id: p.id, categoriaId: p.categoria_id, slug: p.slug, nome: p.nome, descricao: p.descricao, modoDeUso: p.modo_de_uso,
    ingredientes: p.ingredientes, criadoEm: p.criado_em, atualizadoEm: p.atualizado_em,
    categoria: { slug: p.categorias.slug, nome: p.categorias.nome },
    variacoes: (p.variacoes ?? []).map(paraVariacao),
  };
}

function paraFrete(f: LinhaFrete): FreteRegiao {
  return { nome: f.nome, cepInicio: f.cep_inicio, cepFim: f.cep_fim, modo: f.modo, valorCentavos: f.valor_centavos, prazoTexto: f.prazo_texto };
}

// Consulta-base de produto publicado, com categoria publicada e variações publicadas em ordem de preço.
function consultaProdutos(db: SupabaseClient) {
  return db
    .from('produtos')
    .select(COLUNAS_PRODUTO)
    .eq('publicado', true)
    .eq('categorias.publicado', true)
    .eq('variacoes.publicado', true)
    .order('preco_centavos', { referencedTable: 'variacoes' })
    .order('sku', { referencedTable: 'variacoes' })
    .limit(LIMITE_VARIACOES_POR_PRODUTO, { referencedTable: 'variacoes' });
}

export async function listarCategoriasPublicadas(db: SupabaseClient = clientePublico()): Promise<Leitura<Categoria[]>> {
  const { data, error } = await db
    .from('categorias')
    .select('id, slug, nome, ordem')
    .eq('publicado', true)
    .order('ordem')
    .order('nome')
    .limit(LIMITE_CATEGORIAS);
  if (error) return falhou('catalogo.categorias', error);
  return { ok: true, dados: (data ?? []) as Categoria[] };
}

export async function listarProdutosPublicados(
  opcoes: { categoria?: string; limite: number },
  db: SupabaseClient = clientePublico(),
): Promise<Leitura<ProdutoComVariacoes[]>> {
  if (opcoes.categoria !== undefined && !SLUG.test(opcoes.categoria)) return { ok: true, dados: [] };
  let consulta = consultaProdutos(db);
  if (opcoes.categoria !== undefined) consulta = consulta.eq('categorias.slug', opcoes.categoria);
  const { data, error } = await consulta.order('nome').order('id').limit(limitar(opcoes.limite, LIMITE_MAXIMO_PRODUTOS));
  if (error) return falhou('catalogo.produtos', error);
  return { ok: true, dados: ((data ?? []) as unknown as LinhaProduto[]).map(paraProduto) };
}

// Não achou (ou está em rascunho, ou a categoria saiu do ar) → { ok: true, dados: null }: a página responde 404.
export async function lerProdutoPorSlug(slug: string, db: SupabaseClient = clientePublico()): Promise<Leitura<ProdutoComVariacoes | null>> {
  if (!SLUG.test(slug)) return { ok: true, dados: null };
  const { data, error } = await consultaProdutos(db).eq('slug', slug).limit(1).maybeSingle();
  if (error) return falhou('catalogo.produto', error);
  return { ok: true, dados: data ? paraProduto(data as unknown as LinhaProduto) : null };
}

// O CEP não vai para o log (dado de localização do comprador).
export async function lerFretePorCep(cep: string, db: SupabaseClient = clientePublico()): Promise<LeituraFrete> {
  const normalizado = normalizarCep(cep);
  if (!normalizado) return { ok: false, motivo: 'cep-invalido' };
  // `ativo` está fora do GRANT de anon: quem esconde a faixa desligada é a RLS.
  const { data, error } = await db
    .from('fretes_regiao')
    .select(COLUNAS_FRETE)
    .lte('cep_inicio', normalizado)
    .gte('cep_fim', normalizado)
    .order('modo')
    .order('valor_centavos')
    .order('cep_inicio')
    .limit(LIMITE_FAIXAS_FRETE);
  if (error) return falhou('catalogo.frete', error);
  const opcoes = escolherFretes(((data ?? []) as LinhaFrete[]).map(paraFrete), normalizado);
  if (opcoes.length === 0) return { ok: false, motivo: 'sem-frete' };
  return { ok: true, cep: normalizado, opcoes };
}
