import { describe, expect, it, vi } from 'vitest';
import { bancoFalso } from './banco-falso.apoio';
import { lerPedidosResumidos, resumirPedido, rotuloDoPedido, type LinhaPedido } from './resumo';

vi.spyOn(console, 'error').mockImplementation(() => {});

const COM_ITENS: LinhaPedido = {
  id: 'p1', produto: null, valor_centavos: null, total_centavos: 13400, status: 'aberto', criado_em: '2026-11-03T12:00:00Z',
  itens_pedido: [{ quantidade: 2 }, { quantidade: 1 }],
};
const DO_STARTER: LinhaPedido = { id: 'p2', produto: 'curso', valor_centavos: 1000, status: 'pago', criado_em: '2026-10-01T12:00:00Z' };

describe('linha de pedido em /conta e /admin (B2)', () => {
  it('pedido com itens: total congelado e "Pedido com N itens", nunca R$ 0,00 sem nome', () => {
    const r = resumirPedido(COM_ITENS);
    expect(r.valorCentavos).toBe(13400);
    expect(rotuloDoPedido(r)).toBe('Pedido com 3 itens');
    expect(rotuloDoPedido(resumirPedido({ ...COM_ITENS, itens_pedido: [{ quantidade: 1 }] }))).toBe('Pedido com 1 item');
  });

  it('pedido do starter: valor e nome do produto, como antes', () => {
    const r = resumirPedido(DO_STARTER);
    expect(r.valorCentavos).toBe(1000);
    expect(rotuloDoPedido(r, (s) => (s === 'curso' ? 'Curso' : s))).toBe('Curso');
  });

  it('lê total_centavos e os itens; com o schema antigo, relê só as colunas antigas', async () => {
    const novo = bancoFalso(() => ({ data: [COM_ITENS], error: null }));
    const r = await lerPedidosResumidos(novo.db, 20);
    expect(r.ok && r.dados[0].valorCentavos).toBe(13400);
    expect(String(novo.consultas[0].find(([m]) => m === 'select')?.[1])).toContain('total_centavos');

    let vez = 0;
    const antigo = bancoFalso(() => (vez++ === 0 ? { data: null, error: { code: '42703', message: 'column does not exist' } } : { data: [DO_STARTER], error: null }));
    const r2 = await lerPedidosResumidos(antigo.db, 20);
    expect(r2.ok && r2.dados.map((x) => rotuloDoPedido(x))).toEqual(['curso']);
    expect(String(antigo.consultas[1].find(([m]) => m === 'select')?.[1])).not.toContain('total_centavos');
  });

  it('outro erro do banco vira falha da lista, sem fingir que não há pedidos', async () => {
    const b = bancoFalso(() => ({ data: null, error: { code: '57014', message: 'timeout' } }));
    expect(await lerPedidosResumidos(b.db, 20)).toEqual({ ok: false });
  });
});
