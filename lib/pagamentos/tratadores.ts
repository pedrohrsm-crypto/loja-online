// O que cada evento do processador faz com o pedido. Todo tratador é IDEMPOTENTE: o mesmo
// evento pode chegar de novo (reentrega, reserva recuperada) sem efeito duplicado.
import { DadoInvalido, type Tratador } from './webhook';

export type StatusPedido = 'aberto' | 'pago' | 'estornado' | 'cancelado';

export interface RepositorioPedidos {
  /** Aberto → pago. Devolve quantas linhas mudaram (0 ou 1). Lança em erro de banco. */
  marcarPago(pedidoId: string, sessaoId: string, pagamentoId: string | null): Promise<number>;
  lerStatus(pedidoId: string): Promise<StatusPedido | null>;
  /** Pago → estornado, pelo payment_intent. Devolve quantas linhas mudaram. */
  marcarEstornado(pagamentoId: string): Promise<number>;
}

type Sessao = { id: string; payment_status?: string; payment_intent?: string | null; metadata?: Record<string, string> | null };
type Cobranca = { payment_intent?: string | null; amount?: number; amount_refunded?: number; refunded?: boolean };

async function confirmarPagamento(repo: RepositorioPedidos, s: Sessao): Promise<void> {
  const pedidoId = s.metadata?.pedido_id;
  if (!pedidoId) throw new DadoInvalido(`sessão ${s.id} sem pedido_id`);
  if (await repo.marcarPago(pedidoId, s.id, s.payment_intent ?? null)) return;
  const status = await repo.lerStatus(pedidoId);
  if (status === 'pago' || status === 'estornado') return; // já tratado: reentrega
  if (status === null) throw new DadoInvalido(`pedido ${pedidoId} inexistente`);
  // Pago no processador, mas o pedido não estava aberto (cancelado, sessão trocada):
  // não é transitório; vai para o log e a reconciliação mostra para revisão.
  throw new DadoInvalido(`pedido ${pedidoId} em ${status} recebeu pagamento`);
}

export function tratadoresDePedido(repo: RepositorioPedidos): Record<string, Tratador> {
  return {
    'checkout.session.completed': async (o) => {
      const s = o as Sessao;
      // Pix e boleto concluem a sessão ANTES do dinheiro: o pago chega no evento assíncrono.
      if (s.payment_status !== 'paid') return;
      await confirmarPagamento(repo, s);
    },
    'checkout.session.async_payment_succeeded': async (o) => confirmarPagamento(repo, o as Sessao),
    'charge.refunded': async (o) => {
      const c = o as Cobranca;
      if (!c.payment_intent) throw new DadoInvalido('estorno sem payment_intent');
      const total = c.refunded === true || (c.amount !== undefined && c.amount_refunded === c.amount);
      if (!total) return; // estorno parcial: decisão do cliente, fora do automático
      await repo.marcarEstornado(c.payment_intent);
    },
  };
}
