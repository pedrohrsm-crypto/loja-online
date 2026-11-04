// Reconciliação do Pix (L5), pura: as portas chegam por parâmetro.
//
// Chamada a cada 15 min pelo GitHub Actions (.github/workflows/reconciliar-pix.yml; o plano Hobby da
// Vercel só aceita cron diário, desvio do CLAUDE.md e risco #9) e uma vez por dia pelo cron da Vercel.
// Em cada rodada, com a trava pega (duas rodadas nunca se sobrepõem):
//   1. expira os pedidos vencidos e devolve a reserva (função de banco do #27; T4);
//   2. para cada pedido com order viva (aberto, ou cancelado sem a order cancelada no Mercado Pago),
//      faz o GET da order e:
//        - paga → confirmar_pagamento_mp (aprovado que o webhook perdeu, T14; pago depois de expirar, T5);
//        - aguardando e o pedido já cancelado → cancela a order no Mercado Pago (fecha a janela do T5);
//        - encerrada e o pedido cancelado → só marca que não há mais o que olhar.
// Sem resposta do Mercado Pago, não decide nada: conta como falha, e a rodada responde 500 para o
// agendador avisar (o GitHub manda e-mail quando o workflow falha).
import { log } from '@/lib/observabilidade/logger';
import type { ConfigMP } from './config';
import { FalhaTransitoria, conferirOrder, type PortasConfirmacao, type ResultadoConfirmacao } from './confirmar';
import { podeCancelar } from './order';
import { chaveDoCancelamento } from './cobranca';

export const NOME_TRAVA = 'reconciliar-pix';
export const DURACAO_TRAVA_MS = 5 * 60_000;

export type PedidoComOrder = { id: string; status: 'aberto' | 'cancelado'; mpOrderId: string };

export interface PortasReconciliacao extends PortasConfirmacao {
  adquirirTrava(nome: string, duracaoMs: number): Promise<string | null>;
  liberarTrava(nome: string, dono: string): Promise<void>;
  expirarVencidos(): Promise<number>;
  pedidosComOrderViva(limite: number): Promise<PedidoComOrder[]>;
  cancelarOrder(orderId: string, chave: string): Promise<{ ok: boolean; transitorio: boolean }>;
  marcarCanceladaNoMP(pedidoId: string): Promise<void>;
}

export type ResumoRodada = {
  sobreposta: boolean;
  expirados: number | null;
  conferidos: number;
  confirmados: Partial<Record<ResultadoConfirmacao, number>>;
  canceladasNoMP: number;
  falhas: number;
};

const ESCOPO = 'pagamentos.reconciliar';

export async function rodadaDeReconciliacao(config: ConfigMP, portas: PortasReconciliacao, limite = 100): Promise<ResumoRodada> {
  const resumo: ResumoRodada = { sobreposta: false, expirados: null, conferidos: 0, confirmados: {}, canceladasNoMP: 0, falhas: 0 };
  const dono = await portas.adquirirTrava(NOME_TRAVA, DURACAO_TRAVA_MS);
  if (!dono) {
    log.warn(ESCOPO, 'outra rodada em andamento; esta não roda');
    return { ...resumo, sobreposta: true };
  }
  try {
    try {
      resumo.expirados = await portas.expirarVencidos();
    } catch (e) {
      resumo.falhas += 1;
      log.error(ESCOPO, 'expiração falhou', { erro: e instanceof Error ? e.message : String(e) });
    }

    let pedidos: PedidoComOrder[] = [];
    try {
      pedidos = await portas.pedidosComOrderViva(limite);
    } catch (e) {
      resumo.falhas += 1;
      log.error(ESCOPO, 'falha ao ler os pedidos com order', { erro: e instanceof Error ? e.message : String(e) });
    }

    for (const p of pedidos) {
      resumo.conferidos += 1;
      try {
        const c = await conferirOrder(p.mpOrderId, config.modo, portas, ESCOPO);
        if (c.tipo === 'confirmado') {
          resumo.confirmados[c.resultado] = (resumo.confirmados[c.resultado] ?? 0) + 1;
          continue;
        }
        if (p.status !== 'cancelado') continue;
        if (c.tipo === 'sem-efeito' && podeCancelar(c.order)) {
          const r = await portas.cancelarOrder(p.mpOrderId, chaveDoCancelamento(p.id));
          if (!r.ok) {
            resumo.falhas += 1;
            continue;
          }
        } else if (c.tipo === 'sem-efeito' && c.situacao === 'pendente') {
          continue; // processando: a próxima rodada olha de novo
        }
        await portas.marcarCanceladaNoMP(p.id);
        resumo.canceladasNoMP += 1;
      } catch (e) {
        resumo.falhas += 1;
        log.error(ESCOPO, 'pedido não conferido', { pedido: p.id, transitoria: e instanceof FalhaTransitoria, erro: e instanceof Error ? e.message : String(e) });
      }
    }
  } finally {
    await portas.liberarTrava(NOME_TRAVA, dono).catch((e) => log.error(ESCOPO, 'falha ao soltar a trava (vence sozinha)', { erro: e instanceof Error ? e.message : String(e) }));
  }
  log.info(ESCOPO, 'rodada concluída', resumo);
  return resumo;
}
