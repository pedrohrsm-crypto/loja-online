// Núcleo do webhook de pagamento, puro: a rota só lê a requisição e chama isto.
//
// Regras (kit/freelance/modulos/pagamentos.md §3):
// - Assinatura inválida → 400.
// - Cada evento é processado UMA vez: reservado antes de tocar em estado. Reentrega de
//   evento já concluído → 200 sem refazer nada.
// - Reserva parada (a função morreu no meio) é RECUPERADA depois da janela; mais nova que
//   isso, o evento pode estar em andamento em outra instância → 409, e o Stripe reentrega.
// - Falha transitória (banco fora, rede) → devolve a reserva e responde 500, para o
//   Stripe retentar (04, erro 3.1: 200 com o banco falhando perde a cobrança).
// - Dado inválido, que reentregar não conserta → conclui e responde 200: 500 permanente
//   faz o Stripe desativar o endpoint.
// - Tipo de evento sem tratador → 200 (ignorado, registrado).
import { verificarAssinatura } from './assinatura';
import { log, infoDoErro } from '@/lib/observabilidade/logger';

export type Reserva = 'reservado' | 'recuperado' | 'duplicado' | 'em-andamento';

export interface RepositorioEventos {
  reservar(id: string, tipo: string): Promise<Reserva>;
  concluir(id: string): Promise<void>;
  devolver(id: string): Promise<void>;
}

export type Evento = { id: string; type: string; data: { object: unknown } };
export type Tratador = (objeto: unknown, evento: Evento) => Promise<void>;

/** Erro que reentregar não conserta (dado malformado, referência inexistente). */
export class DadoInvalido extends Error {}

export type Resposta = { status: number; corpo: { recebido?: true; erro?: string; resultado?: string } };

export async function processarWebhook(p: {
  corpo: string;
  cabecalho: string | null;
  segredo: string | undefined;
  repo: RepositorioEventos;
  tratadores: Record<string, Tratador>;
  agoraMs?: number;
}): Promise<Resposta> {
  if (!p.segredo) {
    log.error('pagamentos.webhook', 'segredo do webhook ausente');
    return { status: 500, corpo: { erro: 'não configurado' } };
  }
  if (!p.cabecalho || !verificarAssinatura(p.corpo, p.cabecalho, p.segredo, p.agoraMs)) {
    return { status: 400, corpo: { erro: 'assinatura inválida' } };
  }

  let evento: Evento;
  try {
    evento = JSON.parse(p.corpo) as Evento;
    if (!evento?.id || !evento?.type) throw new Error('sem id ou tipo');
  } catch {
    return { status: 400, corpo: { erro: 'corpo inválido' } };
  }

  const tratador = p.tratadores[evento.type];
  if (!tratador) {
    log.info('pagamentos.webhook', 'evento ignorado', { evento: evento.id, tipo: evento.type });
    return { status: 200, corpo: { recebido: true, resultado: 'ignorado' } };
  }

  let reserva: Reserva;
  try {
    reserva = await p.repo.reservar(evento.id, evento.type);
  } catch (e) {
    log.error('pagamentos.webhook', 'falha ao reservar', { evento: evento.id, ...infoDoErro(e) });
    return { status: 500, corpo: { erro: 'falha transitória' } };
  }
  if (reserva === 'duplicado') return { status: 200, corpo: { recebido: true, resultado: 'duplicado' } };
  if (reserva === 'em-andamento') return { status: 409, corpo: { erro: 'em andamento' } };
  if (reserva === 'recuperado') log.warn('pagamentos.webhook', 'reserva parada retomada', { evento: evento.id });

  try {
    await tratador(evento.data.object, evento);
  } catch (e) {
    if (e instanceof DadoInvalido) {
      log.error('pagamentos.webhook', 'dado inválido, evento concluído sem efeito', { evento: evento.id, ...infoDoErro(e) });
      await p.repo.concluir(evento.id).catch(() => {});
      return { status: 200, corpo: { recebido: true, resultado: 'invalido' } };
    }
    log.error('pagamentos.webhook', 'falha transitória no tratador', { evento: evento.id, ...infoDoErro(e) });
    await p.repo.devolver(evento.id).catch((e2) => log.error('pagamentos.webhook', 'falha ao devolver reserva', infoDoErro(e2)));
    return { status: 500, corpo: { erro: 'falha transitória' } };
  }

  try {
    await p.repo.concluir(evento.id);
  } catch (e) {
    // O efeito já aconteceu, mas sem "concluído" a reentrega reprocessa. Todo tratador é
    // idempotente, então reprocessar é seguro; 500 garante que o Stripe tente de novo.
    log.error('pagamentos.webhook', 'falha ao concluir', { evento: evento.id, ...infoDoErro(e) });
    return { status: 500, corpo: { erro: 'falha transitória' } };
  }
  return { status: 200, corpo: { recebido: true, resultado: 'processado' } };
}
