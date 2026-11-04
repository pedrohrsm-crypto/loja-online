// Webhook do Mercado Pago (evento "Order (Mercado Pago)"; URL cadastrada no painel pelo Pedro em 4-Nov).
// Adaptador fino: lê corpo cru, cabeçalhos e query, e delega ao núcleo puro (lib/pagamentos/webhook.ts).
import { lerConfigMP } from '@/lib/pagamentos/config';
import { portasWebhook } from '@/lib/pagamentos/repositorios';
import { processarWebhook } from '@/lib/pagamentos/webhook';
import { clienteAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
// O Mercado Pago espera a resposta por 22 s; o GET da order tem 8 s no máximo.
export const maxDuration = 20;

export async function POST(request: Request) {
  const url = new URL(request.url);
  const config = lerConfigMP();
  const corpo = await request.text();
  const base = {
    corpo,
    xSignature: request.headers.get('x-signature'),
    xRequestId: request.headers.get('x-request-id'),
    dataId: url.searchParams.get('data.id'),
    tipo: url.searchParams.get('type'),
    config,
  };
  if (!config.ok) {
    // Sem configuração, o núcleo responde 500 antes de tocar em qualquer porta.
    const r = await processarWebhook({ ...base, eventos: SEM_PORTA.eventos, portas: SEM_PORTA.portas });
    return Response.json(r.corpo, { status: r.status });
  }
  const r = await processarWebhook({ ...base, ...portasWebhook(clienteAdmin(), config.config) });
  return Response.json(r.corpo, { status: r.status });
}

const nunca = async (): Promise<never> => {
  throw new Error('porta usada sem configuração');
};
const SEM_PORTA = {
  eventos: { reservar: nunca, concluir: nunca, devolver: nunca },
  portas: { buscarOrder: nunca, confirmar: nunca },
};
