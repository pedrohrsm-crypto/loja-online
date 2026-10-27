// Reconciliação diária: confere os pedidos abertos contra o processador e corrige o que o
// webhook perdeu. Pura: quem chama busca as sessões e aplica as correções.
export type PedidoAberto = { id: string; sessaoId: string | null; criadoEm: Date };
export type SessaoRemota = { status: 'open' | 'complete' | 'expired'; payment_status: string; payment_intent?: string | null };
export type Correcao =
  | { pedidoId: string; acao: 'marcar-pago'; sessaoId: string; pagamentoId: string | null }
  | { pedidoId: string; acao: 'cancelar'; motivo: 'sessao-expirada' | 'abandonado' };

export const ABANDONO_HORAS = 48;

export async function reconciliar(
  abertos: PedidoAberto[],
  buscarSessao: (id: string) => Promise<SessaoRemota | null>,
  agora: Date,
): Promise<{ correcoes: Correcao[]; falhas: string[] }> {
  const correcoes: Correcao[] = [];
  const falhas: string[] = [];
  for (const p of abertos) {
    if (!p.sessaoId) {
      if (agora.getTime() - p.criadoEm.getTime() > ABANDONO_HORAS * 3_600_000) correcoes.push({ pedidoId: p.id, acao: 'cancelar', motivo: 'abandonado' });
      continue;
    }
    let s: SessaoRemota | null;
    try {
      s = await buscarSessao(p.sessaoId);
    } catch {
      falhas.push(p.id); // não decide nada sem a resposta do processador
      continue;
    }
    if (!s) { falhas.push(p.id); continue; }
    if (s.status === 'complete' && s.payment_status === 'paid') correcoes.push({ pedidoId: p.id, acao: 'marcar-pago', sessaoId: p.sessaoId, pagamentoId: s.payment_intent ?? null });
    else if (s.status === 'expired') correcoes.push({ pedidoId: p.id, acao: 'cancelar', motivo: 'sessao-expirada' });
  }
  return { correcoes, falhas };
}
