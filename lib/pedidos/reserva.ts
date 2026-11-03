// Devolução da reserva (#27), pronta para a F4 chamar: a reconciliação de 15 min expira os
// vencidos, e o pagamento recusado ou abandonado cancela um pedido. As duas funções de banco
// devolvem a reserva UMA vez só (transição aberto → cancelado), então chamar de novo é seguro.
// Recebem o cliente com a service_role (lib/supabase/admin.ts); erro de banco sobe como exceção,
// para a rotina registrar e tentar de novo, nunca para virar "0 expirados".
import type { SupabaseClient } from '@supabase/supabase-js';

export class ErroReserva extends Error {}

export async function expirarPedidosVencidos(db: SupabaseClient, limite = 100): Promise<number> {
  // A folga além do prazo (o Pix pago no último segundo ainda acha a reserva) mora na função de banco.
  const { data, error } = await db.rpc('expirar_pedidos_vencidos', { p_limite: limite });
  if (error) throw new ErroReserva(`expirar_pedidos_vencidos: ${error.code ?? 'sem código'}`);
  if (typeof data !== 'number' || !Number.isSafeInteger(data) || data < 0) throw new ErroReserva('expirar_pedidos_vencidos: resposta inesperada');
  return data;
}

// true = cancelou agora e devolveu a reserva; false = o pedido já não estava aberto.
export async function cancelarPedidoAberto(db: SupabaseClient, pedidoId: string): Promise<boolean> {
  const { data, error } = await db.rpc('cancelar_pedido_aberto', { p_pedido_id: pedidoId });
  if (error) throw new ErroReserva(`cancelar_pedido_aberto: ${error.code ?? 'sem código'}`);
  if (typeof data !== 'boolean') throw new ErroReserva('cancelar_pedido_aberto: resposta inesperada');
  return data;
}
