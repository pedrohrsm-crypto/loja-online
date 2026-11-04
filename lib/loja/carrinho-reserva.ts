// Leitura da reserva do próprio comprador (L6), para a conferência do carrinho (lib/loja/acoes.ts).
// Com o cliente do comprador: a RLS dá só os pedidos e itens dele. Sem sessão, nada a somar. Erro de
// leitura vai para o log e devolve lista vazia: a conferência segue como antes (pode marcar "Esgotado"
// por engano), nunca inventa estoque.
import 'server-only';
import { log } from '@/lib/observabilidade/logger';
import { clienteServidor } from '@/lib/supabase/servidor';

export async function lerReservaPropria(): Promise<{ variacaoId: string; quantidade: number }[]> {
  const supabase = await clienteServidor();
  const { data: sessao } = await supabase.auth.getUser();
  if (!sessao.user) return [];
  const { data, error } = await supabase.from('pedidos').select('id, itens_pedido(variacao_id, quantidade)')
    .eq('usuario_id', sessao.user.id).eq('status', 'aberto').is('produto', null).gt('expira_em', new Date().toISOString()).limit(1);
  if (error) {
    log.warn('carrinho.reserva', 'reserva própria não lida', { codigo: error.code });
    return [];
  }
  const linhas = (data ?? []) as { itens_pedido: { variacao_id: string; quantidade: number }[] | null }[];
  return linhas.flatMap((p) => (p.itens_pedido ?? []).map((i) => ({ variacaoId: i.variacao_id, quantidade: i.quantidade })));
}
