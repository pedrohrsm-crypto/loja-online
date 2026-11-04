// Reconciliação do Pix (L5). Dois agendadores, a mesma rodada, com trava contra sobreposição:
// - GitHub Actions a cada 15 min (.github/workflows/reconciliar-pix.yml), por POST;
// - cron diário da Vercel (vercel.json), que chama por GET (é como a Vercel chama).
// Os dois mandam `Authorization: Bearer <CRON_SECRET>`, comparado em tempo constante (FIDELIDADE §1,
// regra 9). Responde 500 quando algo falhou, para o agendador avisar; nunca "200 sem ter feito nada".
import { timingSafeEqual } from 'node:crypto';
import { lerConfigMP } from '@/lib/pagamentos/config';
import { rodadaDeReconciliacao } from '@/lib/pagamentos/reconciliar';
import { portasReconciliacao } from '@/lib/pagamentos/repositorios';
import { log } from '@/lib/observabilidade/logger';
import { clienteAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function autorizado(request: Request): boolean {
  const esperado = process.env.CRON_SECRET;
  const recebido = request.headers.get('authorization') ?? '';
  if (!esperado) return false;
  const a = Buffer.from(`Bearer ${esperado}`);
  const b = Buffer.from(recebido);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function rodar(request: Request): Promise<Response> {
  if (!autorizado(request)) return Response.json({ erro: 'não autorizado' }, { status: 401 });
  const config = lerConfigMP();
  if (!config.ok) {
    log.error('pagamentos.reconciliar', 'configuração do Mercado Pago incompleta', { faltando: config.faltando });
    return Response.json({ erro: 'não configurado' }, { status: 500 });
  }
  try {
    const resumo = await rodadaDeReconciliacao(config.config, portasReconciliacao(clienteAdmin(), config.config));
    const falhou = resumo.falhas > 0 || resumo.expirados === null;
    // Sobreposta não é falha: a outra rodada está fazendo o trabalho.
    return Response.json(resumo, { status: resumo.sobreposta ? 200 : falhou ? 500 : 200 });
  } catch (e) {
    log.error('pagamentos.reconciliar', 'rodada não começou', { erro: e instanceof Error ? e.message : String(e) });
    return Response.json({ erro: 'falha transitória' }, { status: 500 });
  }
}

export const GET = rodar;
export const POST = rodar;
