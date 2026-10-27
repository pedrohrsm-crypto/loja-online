import { describe, expect, it } from 'vitest';
import { tratadoresDePedido, type RepositorioPedidos, type StatusPedido } from './tratadores';
import { DadoInvalido, type Evento } from './webhook';

class Repo implements RepositorioPedidos {
  pedidos = new Map<string, { status: StatusPedido; pagamento?: string | null }>([['p1', { status: 'aberto' }]]);
  async marcarPago(id: string, _s: string, pagamento: string | null) {
    const p = this.pedidos.get(id);
    if (!p || p.status !== 'aberto') return 0;
    p.status = 'pago';
    p.pagamento = pagamento;
    return 1;
  }
  async lerStatus(id: string) { return this.pedidos.get(id)?.status ?? null; }
  async marcarEstornado(pagamento: string) {
    for (const p of this.pedidos.values()) if (p.pagamento === pagamento && p.status === 'pago') { p.status = 'estornado'; return 1; }
    return 0;
  }
}

const ev = { id: 'e', type: 't', data: { object: {} } } as Evento;
const sessao = (extra: object = {}) => ({ id: 'cs_1', payment_status: 'paid', payment_intent: 'pi_1', metadata: { pedido_id: 'p1' }, ...extra });

describe('tratadores de pedido', () => {
  it('pagamento confirmado marca pago, e a reentrega não muda nada', async () => {
    const repo = new Repo();
    const t = tratadoresDePedido(repo);
    await t['checkout.session.completed'](sessao(), ev);
    await t['checkout.session.completed'](sessao(), ev);
    expect(repo.pedidos.get('p1')?.status).toBe('pago');
  });

  it('Pix e boleto: sessão concluída sem pagamento não libera; o evento assíncrono libera', async () => {
    const repo = new Repo();
    const t = tratadoresDePedido(repo);
    await t['checkout.session.completed'](sessao({ payment_status: 'unpaid' }), ev);
    expect(repo.pedidos.get('p1')?.status).toBe('aberto');
    await t['checkout.session.async_payment_succeeded'](sessao(), ev);
    expect(repo.pedidos.get('p1')?.status).toBe('pago');
  });

  it('pedido inexistente ou cancelado é dado inválido, não falha transitória', async () => {
    const repo = new Repo();
    repo.pedidos.set('p2', { status: 'cancelado' });
    const t = tratadoresDePedido(repo);
    await expect(t['checkout.session.completed'](sessao({ metadata: { pedido_id: 'nao-existe' } }), ev)).rejects.toBeInstanceOf(DadoInvalido);
    await expect(t['checkout.session.completed'](sessao({ metadata: { pedido_id: 'p2' } }), ev)).rejects.toBeInstanceOf(DadoInvalido);
  });

  it('estorno total retira o acesso; parcial não mexe', async () => {
    const repo = new Repo();
    const t = tratadoresDePedido(repo);
    await t['checkout.session.completed'](sessao(), ev);
    await t['charge.refunded']({ payment_intent: 'pi_1', amount: 100, amount_refunded: 50 }, ev);
    expect(repo.pedidos.get('p1')?.status).toBe('pago');
    await t['charge.refunded']({ payment_intent: 'pi_1', amount: 100, amount_refunded: 100 }, ev);
    expect(repo.pedidos.get('p1')?.status).toBe('estornado');
  });

  it('erro de banco sobe como erro comum (transitório → 500 no webhook)', async () => {
    const repo = new Repo();
    repo.marcarPago = async () => { throw new Error('banco fora'); };
    const t = tratadoresDePedido(repo);
    await expect(t['checkout.session.completed'](sessao(), ev)).rejects.not.toBeInstanceOf(DadoInvalido);
  });
});
