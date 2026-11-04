// Dublê para os testes unitários do Pix (#32): um Mercado Pago falso (orders em memória) e um banco
// falso que imita o CONTRATO de confirmar_pagamento_mp (a regra de verdade é provada na bancada SQL,
// supabase/bancada/testes/08_pix_mercado_pago.sql). Não é usado fora dos testes.
import type { ModoPagamento } from './config';
import type { LeituraOrderRemota, PortasConfirmacao, ResultadoConfirmacao } from './confirmar';
import type { RepositorioEventos, Reserva } from './webhook';

export type OrderFalsa = {
  id: string;
  status: string;
  status_detail: string;
  external_reference: string;
  total_amount: string;
  transactions?: unknown;
};

export type PedidoFalso = {
  id: string;
  status: 'aberto' | 'pago' | 'cancelado' | 'estornado';
  totalCentavos: number;
  modo: ModoPagamento;
  mpOrderId: string | null;
  estoqueParaReativar: boolean;
  alerta: string | null;
};

export class LojaFalsa implements PortasConfirmacao, RepositorioEventos {
  orders = new Map<string, OrderFalsa>();
  pedidos = new Map<string, PedidoFalso>();
  eventos = new Map<string, 'reservado' | 'concluido'>();
  gets = 0;
  confirmacoes = 0;
  /** Quantas vezes um pedido virou pago (a "baixa"): T9 exige 1. */
  baixas = new Map<string, number>();
  falharGet: 'transitorio' | 'recusa' | null = null;
  falharBanco = false;

  orderPaga(id: string, pedidoId: string, total: string, extra: Partial<OrderFalsa> = {}) {
    this.orders.set(id, { id, status: 'processed', status_detail: 'accredited', external_reference: pedidoId, total_amount: total, ...extra });
  }

  pedido(p: Partial<PedidoFalso> & { id: string }) {
    this.pedidos.set(p.id, { status: 'aberto', totalCentavos: 7500, modo: 'teste', mpOrderId: null, estoqueParaReativar: true, alerta: null, ...p });
  }

  async buscarOrder(orderId: string): Promise<LeituraOrderRemota> {
    this.gets += 1;
    if (this.falharGet) return { ok: false, transitorio: this.falharGet === 'transitorio' };
    const o = this.orders.get(orderId);
    return o ? { ok: true, json: structuredClone(o) } : { ok: false, transitorio: false };
  }

  async confirmar(a: { orderId: string; externalReference: string | null; valorCentavos: number; modo: ModoPagamento }): Promise<ResultadoConfirmacao> {
    if (this.falharBanco) throw new Error('banco fora');
    this.confirmacoes += 1;
    const p = [...this.pedidos.values()].find((x) => x.mpOrderId === a.orderId);
    if (!p) return 'nao-encontrado';
    if (p.status === 'pago' || p.status === 'estornado') return 'ja-pago';
    if (p.modo !== a.modo) return 'modo-divergente';
    if (a.externalReference !== p.id) { p.alerta ??= 'pedido-divergente'; return 'pedido-divergente'; }
    if (a.valorCentavos !== p.totalCentavos) { p.alerta ??= 'valor-divergente'; return 'valor-divergente'; }
    if (p.status === 'cancelado') {
      if (!p.estoqueParaReativar) { p.alerta ??= 'estorno-pendente'; return 'estorno-pendente'; }
      p.status = 'pago';
      this.baixas.set(p.id, (this.baixas.get(p.id) ?? 0) + 1);
      return 'reativado';
    }
    p.status = 'pago';
    this.baixas.set(p.id, (this.baixas.get(p.id) ?? 0) + 1);
    return 'pago';
  }

  async reservar(id: string): Promise<Reserva> {
    if (this.falharBanco) throw new Error('banco fora');
    const e = this.eventos.get(id);
    if (e === 'concluido') return 'duplicado';
    if (e === 'reservado') return 'em-andamento';
    this.eventos.set(id, 'reservado');
    return 'reservado';
  }
  async concluir(id: string) { this.eventos.set(id, 'concluido'); }
  async devolver(id: string) { this.eventos.delete(id); }
}
