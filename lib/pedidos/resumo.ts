// Linha de pedido nas listas de /conta e /admin (#27, B2): o pedido com itens mostra o total
// congelado e "Pedido com N itens"; o do starter (produto único) continua com o nome e o valor dele.
// Com o schema antigo (migration não aplicada), relê só as colunas antigas, sem quebrar a lista.
import type { SupabaseClient } from '@supabase/supabase-js';
import { log } from '@/lib/observabilidade/logger';
import { ehColunaAusente } from '@/lib/supabase/coluna-ausente';

export type LinhaPedido = {
  id: string;
  produto: string | null;
  valor_centavos: number | null;
  total_centavos?: number | null;
  status: string;
  criado_em: string;
  itens_pedido?: { quantidade: number }[] | null;
};

export type ResumoPedido = {
  id: string;
  status: string;
  criadoEm: string;
  // null só se a linha vier sem valor nenhum (a CHECK do banco impede); a tela mostra "—".
  valorCentavos: number | null;
  descricao: { tipo: 'itens'; unidades: number } | { tipo: 'produto'; produto: string };
};

export function resumirPedido(p: LinhaPedido): ResumoPedido {
  const valorCentavos = p.total_centavos ?? p.valor_centavos ?? null;
  const descricao: ResumoPedido['descricao'] = p.produto === null
    ? { tipo: 'itens', unidades: (p.itens_pedido ?? []).reduce((s, i) => s + i.quantidade, 0) }
    : { tipo: 'produto', produto: p.produto };
  return { id: p.id, status: p.status, criadoEm: p.criado_em, valorCentavos, descricao };
}

// "Pedido com 3 itens" / "Pedido com 1 item"; no starter, o nome que a tela der ao produto.
export function rotuloDoPedido(r: ResumoPedido, nomeDoProduto: (slug: string) => string = (s) => s): string {
  if (r.descricao.tipo === 'produto') return nomeDoProduto(r.descricao.produto);
  const n = r.descricao.unidades;
  return `Pedido com ${n} ${n === 1 ? 'item' : 'itens'}`;
}

const COLUNAS = 'id, produto, valor_centavos, total_centavos, status, criado_em, itens_pedido(quantidade)';
const COLUNAS_ANTIGAS = 'id, produto, valor_centavos, status, criado_em';
// PostgREST sem a relação itens_pedido no cache de schema (a tabela ainda não existe).
const RELACAO_AUSENTE = 'PGRST200';

// `db` decide o escopo: o cliente do comprador (RLS: só os dele) ou a service_role (admin, todos).
export async function lerPedidosResumidos(db: SupabaseClient, limite: number): Promise<{ ok: true; dados: ResumoPedido[] } | { ok: false }> {
  const consulta = (colunas: string) => db.from('pedidos').select(colunas).order('criado_em', { ascending: false }).limit(limite);
  let { data, error } = await consulta(COLUNAS);
  if (error && (ehColunaAusente(error.code) || error.code === RELACAO_AUSENTE)) ({ data, error } = await consulta(COLUNAS_ANTIGAS));
  if (error) {
    log.error('pedidos.resumo', 'leitura falhou', { codigo: error.code });
    return { ok: false };
  }
  return { ok: true, dados: ((data ?? []) as unknown as LinhaPedido[]).map(resumirPedido) };
}
