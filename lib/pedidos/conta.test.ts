import { describe, expect, it, vi } from 'vitest';
import { bancoFalso, tem } from './banco-falso.apoio';
import { cancelarPedidosComItensDoTitular } from './conta';

vi.spyOn(console, 'error').mockImplementation(() => {});
const TITULAR = '00000000-0000-4000-8000-0000000000c1';

describe('exclusão de conta: pedidos com itens (B1)', () => {
  it('cancela cada pedido com itens aberto do titular pela função que devolve a reserva', async () => {
    const b = bancoFalso(() => ({ data: [{ id: 'p1' }, { id: 'p2' }], error: null }));
    b.aoChamar(() => ({ data: true, error: null }));
    expect(await cancelarPedidosComItensDoTitular(b.db, TITULAR)).toEqual({ ok: true, cancelados: 2 });
    const leitura = b.consultas[0];
    expect(tem(leitura, 'eq', 'usuario_id', TITULAR) && tem(leitura, 'eq', 'status', 'aberto') && tem(leitura, 'is', 'produto', null)).toBe(true);
    expect(leitura.some(([m]) => m === 'update')).toBe(false);
    expect(b.chamadas).toEqual([
      { fn: 'cancelar_pedido_aberto', args: { p_pedido_id: 'p1' } },
      { fn: 'cancelar_pedido_aberto', args: { p_pedido_id: 'p2' } },
    ]);
  });

  it('pedido que virou pago no meio (false) não é erro e não conta como cancelado', async () => {
    const b = bancoFalso(() => ({ data: [{ id: 'p1' }], error: null }));
    b.aoChamar(() => ({ data: false, error: null }));
    expect(await cancelarPedidosComItensDoTitular(b.db, TITULAR)).toEqual({ ok: true, cancelados: 0 });
  });

  it('erro ao ler ou ao cancelar impede a exclusão (nunca exclui com estoque preso)', async () => {
    const leitura = bancoFalso(() => ({ data: null, error: { code: '57014', message: 'x' } }));
    expect(await cancelarPedidosComItensDoTitular(leitura.db, TITULAR)).toEqual({ ok: false });
    const cancelar = bancoFalso(() => ({ data: [{ id: 'p1' }], error: null }));
    cancelar.aoChamar(() => ({ data: null, error: { code: '42501', message: 'x' } }));
    expect(await cancelarPedidosComItensDoTitular(cancelar.db, TITULAR)).toEqual({ ok: false });
  });
});
