import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConfigMP } from './config';
import { LojaFalsa } from './mp-falso.apoio';
import { rodadaDeReconciliacao, type PedidoComOrder, type PortasReconciliacao } from './reconciliar';

vi.spyOn(console, 'error').mockImplementation(() => {});
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});

const TESTE: ConfigMP = { modo: 'teste', accessToken: 'x', segredoWebhook: 'y' };

class Portas extends LojaFalsa implements PortasReconciliacao {
  trava: string | null = null;
  expirados = 0;
  canceladas: string[] = [];
  marcadas: string[] = [];
  falharExpirar = false;
  async adquirirTrava() { if (this.trava) return null; this.trava = 'dono-1'; return this.trava; }
  async liberarTrava() { this.trava = null; }
  async expirarVencidos() { if (this.falharExpirar) throw new Error('banco fora'); return this.expirados; }
  async pedidosComOrderViva(): Promise<PedidoComOrder[]> {
    return [...this.pedidos.values()].filter((p) => p.mpOrderId && (p.status === 'aberto' || p.status === 'cancelado') && !this.marcadas.includes(p.id))
      .map((p) => ({ id: p.id, status: p.status as 'aberto' | 'cancelado', mpOrderId: p.mpOrderId! }));
  }
  async cancelarOrder(orderId: string) { this.canceladas.push(orderId); return { ok: true, transitorio: false }; }
  async marcarCanceladaNoMP(id: string) { this.marcadas.push(id); }
}

const esperando = (id: string, pedido: string) => ({ id, status: 'action_required', status_detail: 'waiting_transfer', external_reference: pedido, total_amount: '75.00' });

describe('reconciliação do Pix (L5)', () => {
  let p: Portas;
  beforeEach(() => { p = new Portas(); });

  it('T14: aprovado que o webhook perdeu → pago, baixa 1 vez; a rodada seguinte não refaz', async () => {
    p.pedido({ id: 'p1', mpOrderId: 'ORD-1' });
    p.orderPaga('ORD-1', 'p1', '75.00');
    const r = await rodadaDeReconciliacao(TESTE, p);
    expect(r.confirmados).toEqual({ pago: 1 });
    expect(p.pedidos.get('p1')?.status).toBe('pago');
    await rodadaDeReconciliacao(TESTE, p);
    expect(p.baixas.get('p1')).toBe(1);
  });

  it('T4: expira os vencidos (devolve a reserva) e cancela no Mercado Pago a order do pedido expirado', async () => {
    p.expirados = 1;
    p.pedido({ id: 'p2', mpOrderId: 'ORD-2', status: 'cancelado' });
    p.orders.set('ORD-2', esperando('ORD-2', 'p2'));
    const r = await rodadaDeReconciliacao(TESTE, p);
    expect(r).toMatchObject({ expirados: 1, canceladasNoMP: 1, falhas: 0 });
    expect(p.canceladas).toEqual(['ORD-2']);
    expect(p.marcadas).toEqual(['p2']);
  });

  it('T5: pago depois de expirar → com estoque, reativa; sem estoque, estorno pendente (sem pagar)', async () => {
    p.pedido({ id: 'p3', mpOrderId: 'ORD-3', status: 'cancelado' });
    p.orderPaga('ORD-3', 'p3', '75.00');
    p.pedido({ id: 'p4', mpOrderId: 'ORD-4', status: 'cancelado', estoqueParaReativar: false });
    p.orderPaga('ORD-4', 'p4', '75.00');
    const r = await rodadaDeReconciliacao(TESTE, p);
    expect(r.confirmados).toEqual({ reativado: 1, 'estorno-pendente': 1 });
    expect(p.pedidos.get('p3')?.status).toBe('pago');
    expect(p.pedidos.get('p4')).toMatchObject({ status: 'cancelado', alerta: 'estorno-pendente' });
    expect(p.canceladas).toEqual([]);
  });

  it('pedido aberto esperando o Pix: nada muda, nada é cancelado', async () => {
    p.pedido({ id: 'p5', mpOrderId: 'ORD-5' });
    p.orders.set('ORD-5', esperando('ORD-5', 'p5'));
    const r = await rodadaDeReconciliacao(TESTE, p);
    expect(r).toMatchObject({ conferidos: 1, canceladasNoMP: 0, falhas: 0, confirmados: {} });
    expect(p.pedidos.get('p5')?.status).toBe('aberto');
  });

  it('sem resposta do Mercado Pago não decide nada: conta falha e não marca', async () => {
    p.pedido({ id: 'p6', mpOrderId: 'ORD-6', status: 'cancelado' });
    p.falharGet = 'transitorio';
    const r = await rodadaDeReconciliacao(TESTE, p);
    expect(r.falhas).toBe(1);
    expect(p.marcadas).toEqual([]);
    expect(p.canceladas).toEqual([]);
  });

  it('expiração falhou: conta falha, mas o resto da rodada segue', async () => {
    p.falharExpirar = true;
    p.pedido({ id: 'p7', mpOrderId: 'ORD-7' });
    p.orderPaga('ORD-7', 'p7', '75.00');
    const r = await rodadaDeReconciliacao(TESTE, p);
    expect(r).toMatchObject({ expirados: null, falhas: 1, confirmados: { pago: 1 } });
  });

  it('trava: rodada sobreposta não roda; a trava é solta no fim, mesmo com erro', async () => {
    p.trava = 'outra-rodada';
    expect((await rodadaDeReconciliacao(TESTE, p)).sobreposta).toBe(true);
    expect(p.gets).toBe(0);
    p.trava = null;
    p.pedidosComOrderViva = async () => { throw new Error('banco fora'); };
    const r = await rodadaDeReconciliacao(TESTE, p);
    expect(r.falhas).toBe(1);
    expect(p.trava).toBeNull();
  });
});
