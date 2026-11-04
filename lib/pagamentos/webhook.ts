// Núcleo do webhook do Mercado Pago, puro: a rota só lê a requisição e chama isto (L4).
//
// Regras (RISCOS_MERCADO_PAGO.md §1; doc "Configurar notificações" da Orders API, 4-Nov-2026):
// - Assinatura sobre o manifest, nunca sobre o corpo; inválida, malformada ou velha → 400 (T10).
// - O corpo não é assinado: dele só se lê `live_mode` para RECUSAR (nunca para aceitar). O id da
//   order vem da query string (`data.id`, que entra no manifest assinado). Quem decide é o GET (T10).
// - `live_mode` diferente de PAGAMENTO_MODO → 200 com aviso no log, nada muda (T16).
// - Cada notificação é reservada antes de tocar em estado (T8); o EFEITO também é idempotente: a função
//   de banco paga uma vez só, então duas notificações distintas do mesmo pagamento pagam uma vez (T9).
// - Falha transitória (Mercado Pago ou banco fora) → devolve a reserva e responde 500: o Mercado Pago
//   tenta de novo a cada 15 min, e a reconciliação cobre o resto (T11; 04, 3.1).
// - Dado que reentregar não conserta (order inexistente, formato estranho) → 200 e concluído.
// - Responder dentro de 22 s: um GET de no máximo 8 s, uma chamada ao banco e nada de e-mail aqui.
import { log, infoDoErro } from '@/lib/observabilidade/logger';
import { verificarAssinatura } from './assinatura';
import type { LeituraConfigMP } from './config';
import { FalhaTransitoria, conferirOrder, type PortasConfirmacao } from './confirmar';

export type Reserva = 'reservado' | 'recuperado' | 'duplicado' | 'em-andamento';

export interface RepositorioEventos {
  reservar(id: string, tipo: string): Promise<Reserva>;
  concluir(id: string): Promise<void>;
  devolver(id: string): Promise<void>;
}

export type Resposta = { status: number; corpo: { recebido?: true; erro?: string; resultado?: string } };

const ESCOPO = 'pagamentos.webhook';
const ID_ORDER = /^[A-Za-z0-9_-]{1,64}$/;

export async function processarWebhook(p: {
  corpo: string;
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string | null;
  tipo: string | null;
  config: LeituraConfigMP;
  eventos: RepositorioEventos;
  portas: PortasConfirmacao;
  agoraMs?: number;
}): Promise<Resposta> {
  if (!p.config.ok) {
    log.error(ESCOPO, 'configuração do Mercado Pago incompleta', { faltando: p.config.faltando });
    return { status: 500, corpo: { erro: 'não configurado' } };
  }
  const { modo, segredoWebhook } = p.config.config;

  const assinatura = verificarAssinatura({ xSignature: p.xSignature, xRequestId: p.xRequestId, dataId: p.dataId, segredo: segredoWebhook, agoraMs: p.agoraMs });
  if (!assinatura.ok) {
    log.warn(ESCOPO, 'assinatura recusada', { motivo: assinatura.motivo });
    return { status: 400, corpo: { erro: 'assinatura inválida' } };
  }

  let corpo: { type?: unknown; live_mode?: unknown; action?: unknown };
  try {
    const lido: unknown = JSON.parse(p.corpo);
    if (typeof lido !== 'object' || lido === null) throw new Error('não é objeto');
    corpo = lido as typeof corpo;
  } catch {
    return { status: 400, corpo: { erro: 'corpo inválido' } };
  }

  const tipo = p.tipo ?? (typeof corpo.type === 'string' ? corpo.type : null);
  if (tipo !== 'order') {
    log.info(ESCOPO, 'notificação ignorada', { tipo: typeof tipo === 'string' ? tipo.slice(0, 40) : null });
    return { status: 200, corpo: { recebido: true, resultado: 'ignorado' } };
  }
  const orderId = p.dataId?.trim() ?? '';
  if (!ID_ORDER.test(orderId)) return { status: 400, corpo: { erro: 'sem data.id' } };

  if (typeof corpo.live_mode === 'boolean' && (corpo.live_mode ? 'producao' : 'teste') !== modo) {
    log.warn(ESCOPO, 'notificação de outro modo, ignorada', { order: orderId, live_mode: corpo.live_mode, modo });
    return { status: 200, corpo: { recebido: true, resultado: 'modo-divergente' } };
  }

  // Uma notificação = order + request-id: a reentrega da MESMA notificação é duplicada (T8); outra
  // notificação do mesmo pagamento passa, e o efeito idempotente do banco segura (T9).
  const idEvento = `mp:${orderId}:${(p.xRequestId ?? '').slice(0, 80)}`;
  let reserva: Reserva;
  try {
    reserva = await p.eventos.reservar(idEvento, `order.${typeof corpo.action === 'string' ? corpo.action.slice(0, 40) : 'desconhecida'}`);
  } catch (e) {
    log.error(ESCOPO, 'falha ao reservar', { order: orderId, ...infoDoErro(e) });
    return { status: 500, corpo: { erro: 'falha transitória' } };
  }
  if (reserva === 'duplicado') return { status: 200, corpo: { recebido: true, resultado: 'duplicado' } };
  if (reserva === 'em-andamento') return { status: 409, corpo: { erro: 'em andamento' } };
  if (reserva === 'recuperado') log.warn(ESCOPO, 'reserva parada retomada', { order: orderId });

  let resultado: string;
  try {
    const c = await conferirOrder(orderId, modo, p.portas, ESCOPO);
    resultado = c.tipo === 'confirmado' ? c.resultado : c.tipo === 'sem-efeito' ? c.situacao : 'invalido';
  } catch (e) {
    log.error(ESCOPO, 'falha transitória', { order: orderId, transitoria: e instanceof FalhaTransitoria, ...infoDoErro(e) });
    await p.eventos.devolver(idEvento).catch((e2) => log.error(ESCOPO, 'falha ao devolver reserva', infoDoErro(e2)));
    return { status: 500, corpo: { erro: 'falha transitória' } };
  }

  try {
    await p.eventos.concluir(idEvento);
  } catch (e) {
    // O efeito já aconteceu e é idempotente: reprocessar é seguro, e o 500 faz o Mercado Pago tentar de novo.
    log.error(ESCOPO, 'falha ao concluir', { order: orderId, ...infoDoErro(e) });
    return { status: 500, corpo: { erro: 'falha transitória' } };
  }
  return { status: 200, corpo: { recebido: true, resultado } };
}
