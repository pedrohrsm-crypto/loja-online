// Exclusão de conta (#27, B1): antes de qualquer outra coisa, cancela os pedidos COM ITENS ainda
// abertos do titular pelo caminho único que devolve a reserva (cancelar_pedido_aberto). O UPDATE
// direto para 'cancelado' é recusado pelo banco (pedidos_cancelado_devolve_reserva).
// Recebe o cliente com a service_role. Qualquer erro devolve { ok: false }: a conta não é excluída
// com estoque preso.
import type { SupabaseClient } from '@supabase/supabase-js';
import { log } from '@/lib/observabilidade/logger';
import { cancelarPedidoAberto } from './reserva';

// Um comprador tem no máximo um pedido com itens aberto (índice único); o limite só evita ler sem teto.
const LIMITE = 20;

export async function cancelarPedidosComItensDoTitular(db: SupabaseClient, usuarioId: string): Promise<{ ok: true; cancelados: number } | { ok: false }> {
  const { data, error } = await db.from('pedidos').select('id').eq('usuario_id', usuarioId).eq('status', 'aberto').is('produto', null)
    .order('criado_em').limit(LIMITE);
  if (error) {
    log.error('conta.excluir', 'falha ao ler pedidos abertos com itens', { codigo: error.code });
    return { ok: false };
  }
  let cancelados = 0;
  for (const p of (data ?? []) as { id: string }[]) {
    try {
      // false = deixou de estar aberto no meio (pago agora): nada a devolver, e não é erro.
      if (await cancelarPedidoAberto(db, p.id)) cancelados += 1;
    } catch (e) {
      log.error('conta.excluir', 'falha ao cancelar pedido com itens', { pedido: p.id, erro: e instanceof Error ? e.message : String(e) });
      return { ok: false };
    }
  }
  return { ok: true, cancelados };
}
