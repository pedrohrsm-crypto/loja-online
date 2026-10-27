// Idempotency-Key da criação do checkout.
//
// A chave nasce do PEDIDO, nunca do relógio: com `Date.now()` cada clique era uma chave
// nova e a idempotência não protegia nada, e duas abas pagavam duas vezes.
// O hash do corpo entra porque o Stripe recusa a mesma chave com parâmetros diferentes.
// A trava de fundo é o banco: um pedido aberto por usuário e produto (migration 0002).
import { createHash } from 'node:crypto';

export function chaveDoCheckout(pedidoId: string, corpo: Record<string, string>): string {
  const canonico = Object.keys(corpo).sort().map((k) => `${k}=${corpo[k]}`).join('&');
  const hash = createHash('sha256').update(canonico).digest('hex').slice(0, 16);
  return `checkout-${pedidoId}-${hash}`;
}
