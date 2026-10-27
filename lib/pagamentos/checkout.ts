// Abre (ou reaproveita) o pedido e cria a sessão de checkout no Stripe.
//
// Duas travas contra a compra dupla (kit/freelance/modulos/pagamentos.md §3):
// 1. no banco, um pedido ABERTO por usuário e produto (índice único parcial): duas abas
//    caem no mesmo pedido;
// 2. no Stripe, a Idempotency-Key nasce do pedido: o mesmo pedido recebe a mesma sessão.
import type { SupabaseClient } from '@supabase/supabase-js';
import { escrever } from '@/lib/supabase/escrever';
import { chaveDoCheckout } from './chave';
import { stripe, modoDaChave } from './stripe';
import { precoDoStripe, type Produto } from './produtos';

export type ResultadoCheckout = { ok: true; url: string } | { ok: false; mensagem: string };

const VIOLACAO_UNICA = '23505';

async function pedidoAberto(db: SupabaseClient, usuarioId: string, produto: Produto): Promise<string | null> {
  const achar = () => db.from('pedidos').select('id').eq('usuario_id', usuarioId).eq('produto', produto.slug).eq('status', 'aberto').maybeSingle();
  const existente = await achar();
  if (existente.error) return null;
  if (existente.data) return existente.data.id as string;
  const novo = await db.from('pedidos')
    .insert({ usuario_id: usuarioId, produto: produto.slug, valor_centavos: produto.valorCentavos, modo: modoDaChave(process.env.STRIPE_SECRET_KEY) === 'teste' ? 'teste' : 'producao' })
    .select('id').maybeSingle();
  if (novo.data) return novo.data.id as string;
  // Corrida com outra aba: o índice único recusou; o pedido dela é o nosso.
  if (novo.error?.code === VIOLACAO_UNICA) return (await achar()).data?.id ?? null;
  return null;
}

export async function iniciarCheckout(db: SupabaseClient, p: { usuarioId: string; email: string | null; produto: Produto; origem: string }): Promise<ResultadoCheckout> {
  const preco = precoDoStripe(p.produto);
  if (!preco) return { ok: false, mensagem: 'Pagamento indisponível no momento.' };
  const pedidoId = await pedidoAberto(db, p.usuarioId, p.produto);
  if (!pedidoId) return { ok: false, mensagem: 'Não foi possível iniciar a compra. Tente de novo.' };

  const metodos = (process.env.PAGAMENTO_METODOS ?? 'card').split(',').map((m) => m.trim()).filter(Boolean);
  const corpo: Record<string, string> = {
    mode: 'payment',
    'line_items[0][price]': preco,
    'line_items[0][quantity]': '1',
    success_url: `${p.origem}/conta?pagamento=retorno`,
    cancel_url: `${p.origem}/conta?pagamento=cancelado`,
    client_reference_id: pedidoId,
    'metadata[pedido_id]': pedidoId,
    'payment_intent_data[metadata][pedido_id]': pedidoId,
  };
  metodos.forEach((m, i) => { corpo[`payment_method_types[${i}]`] = m; });
  if (p.email) corpo.customer_email = p.email;

  const r = await stripe<{ id: string; url: string }>('/checkout/sessions', { metodo: 'POST', corpo, chaveIdempotencia: chaveDoCheckout(pedidoId, corpo) });
  if (!r.ok) return { ok: false, mensagem: 'Não foi possível abrir o pagamento. Tente de novo.' };

  const gravou = await escrever(db.from('pedidos').update({ stripe_sessao_id: r.dados.id }).eq('id', pedidoId).eq('status', 'aberto').select('id'), {
    esperado: 1, escopo: 'pagamentos.checkout', contexto: { pedido: pedidoId },
  });
  if (!gravou.ok) return { ok: false, mensagem: 'Não foi possível iniciar a compra. Tente de novo.' };
  return { ok: true, url: r.dados.url };
}
