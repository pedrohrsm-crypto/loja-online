import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { cancelarPedidoAberto, ErroReserva, expirarPedidosVencidos } from './reserva';

function banco(resposta: { data: unknown; error: { code?: string; message: string } | null }) {
  const chamadas: Array<{ fn: string; args: unknown }> = [];
  const db = { rpc: async (fn: string, args: unknown) => (chamadas.push({ fn, args }), resposta) } as unknown as SupabaseClient;
  return { db, chamadas };
}

describe('devolução da reserva (API para a F4)', () => {
  it('expirar: devolve quantos cancelou e não manda folga (ela mora na função de banco)', async () => {
    const { db, chamadas } = banco({ data: 3, error: null });
    expect(await expirarPedidosVencidos(db)).toBe(3);
    expect(chamadas).toEqual([{ fn: 'expirar_pedidos_vencidos', args: { p_limite: 100 } }]);
  });

  it('expirar: erro do banco sobe como exceção, nunca vira "0 expirados"', async () => {
    await expect(expirarPedidosVencidos(banco({ data: null, error: { code: 'PGRST202', message: 'x' } }).db)).rejects.toBeInstanceOf(ErroReserva);
    await expect(expirarPedidosVencidos(banco({ data: '2', error: null }).db)).rejects.toBeInstanceOf(ErroReserva);
  });

  it('cancelar: true cancelou agora, false já não estava aberto, outro formato é falha', async () => {
    expect(await cancelarPedidoAberto(banco({ data: true, error: null }).db, 'p')).toBe(true);
    expect(await cancelarPedidoAberto(banco({ data: false, error: null }).db, 'p')).toBe(false);
    await expect(cancelarPedidoAberto(banco({ data: null, error: null }).db, 'p')).rejects.toBeInstanceOf(ErroReserva);
    await expect(cancelarPedidoAberto(banco({ data: null, error: { code: '42501', message: 'x' } }).db, 'p')).rejects.toBeInstanceOf(ErroReserva);
  });
});
