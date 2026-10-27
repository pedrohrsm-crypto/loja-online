// Reconciliação diária (vercel.json): corrige o que o webhook perdeu. Protegida por CRON_SECRET.
import { timingSafeEqual } from 'node:crypto';
import { clienteAdmin } from '@/lib/supabase/admin';
import { reconciliar, type SessaoRemota } from '@/lib/pagamentos/reconciliar';
import { repositorioPedidos } from '@/lib/pagamentos/repositorios';
import { stripe } from '@/lib/pagamentos/stripe';
import { escrever } from '@/lib/supabase/escrever';
import { log } from '@/lib/observabilidade/logger';

export const dynamic = 'force-dynamic';

function autorizado(request: Request): boolean {
  const esperado = process.env.CRON_SECRET;
  const recebido = request.headers.get('authorization') ?? '';
  if (!esperado) return false;
  const a = Buffer.from(`Bearer ${esperado}`);
  const b = Buffer.from(recebido);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  if (!autorizado(request)) return Response.json({ erro: 'não autorizado' }, { status: 401 });
  const db = clienteAdmin();
  const { data, error } = await db.from('pedidos').select('id, stripe_sessao_id, criado_em').eq('status', 'aberto').limit(200);
  if (error) return Response.json({ erro: 'falha ao ler pedidos' }, { status: 500 });

  const { correcoes, falhas } = await reconciliar(
    (data ?? []).map((p) => ({ id: p.id, sessaoId: p.stripe_sessao_id, criadoEm: new Date(p.criado_em) })),
    async (id) => {
      const r = await stripe<SessaoRemota>(`/checkout/sessions/${encodeURIComponent(id)}`, { tempoMaxMs: 8000 });
      if (!r.ok) throw new Error(r.erro);
      return r.dados;
    },
    new Date(),
  );

  const pedidos = repositorioPedidos(db);
  let aplicadas = 0;
  for (const c of correcoes) {
    if (c.acao === 'marcar-pago') {
      aplicadas += await pedidos.marcarPago(c.pedidoId, c.sessaoId, c.pagamentoId);
    } else {
      const r = await escrever(db.from('pedidos').update({ status: 'cancelado' }).eq('id', c.pedidoId).eq('status', 'aberto').select('id'), {
        esperado: 'um-ou-mais', escopo: 'pagamentos.reconciliar.cancelar', contexto: { pedido: c.pedidoId, motivo: c.motivo },
      });
      if (r.ok) aplicadas += r.linhas;
    }
  }
  log.info('pagamentos.reconciliar', 'rodada concluída', { abertos: data?.length ?? 0, correcoes: correcoes.length, aplicadas, falhas: falhas.length });
  return Response.json({ abertos: data?.length ?? 0, correcoes: correcoes.length, aplicadas, falhas: falhas.length });
}
