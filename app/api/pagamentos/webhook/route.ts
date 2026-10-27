// Adaptador fino: lê o corpo CRU (a assinatura é sobre ele) e delega ao núcleo puro.
import { processarWebhook } from '@/lib/pagamentos/webhook';
import { tratadoresDePedido } from '@/lib/pagamentos/tratadores';
import { repositorioEventos, repositorioPedidos } from '@/lib/pagamentos/repositorios';
import { clienteAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // bem abaixo da janela de 5 min da reserva

export async function POST(request: Request) {
  const db = clienteAdmin();
  const r = await processarWebhook({
    corpo: await request.text(),
    cabecalho: request.headers.get('stripe-signature'),
    segredo: process.env.STRIPE_WEBHOOK_SECRET,
    repo: repositorioEventos(db),
    tratadores: tratadoresDePedido(repositorioPedidos(db)),
  });
  return Response.json(r.corpo, { status: r.status });
}
