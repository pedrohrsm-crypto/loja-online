// Cliente mínimo da Orders API do Mercado Pago, sem SDK (L1). Só no servidor: o access token nunca
// chega ao navegador (`server-only` faz o build falhar se um Client Component importar isto).
//
// Regras, com a fonte (referência da API conferida em 4-Nov-2026,
// https://www.mercadopago.com.br/developers/pt/reference/online-payments/checkout-api/create-order/post):
// - toda mutação leva `X-Idempotency-Key` (obrigatória; de 1 a 128 caracteres);
// - tempo máximo de 8 s por chamada: o webhook tem 22 s para responder (RISCOS §1);
// - 5xx, 423, 429 e falha de rede são TRANSITÓRIOS (tentar de novo depois); 4xx é recusa;
// - o corpo de erro vai para o log só com o código, nunca com o que mandamos (o payer leva e-mail).
import 'server-only';
import { log } from '@/lib/observabilidade/logger';
import type { ConfigMP } from './config';

export const API_MP = 'https://api.mercadopago.com';
export const TEMPO_MAXIMO_MS = 8_000;

export type RespostaMP<T> =
  | { ok: true; status: number; dados: T }
  | { ok: false; transitorio: boolean; status: number | null; codigo: string | null };

function codigoDoErro(json: unknown): string | null {
  if (typeof json !== 'object' || json === null) return null;
  const j = json as { errors?: { code?: unknown }[]; error?: unknown; code?: unknown };
  const c = j.errors?.[0]?.code ?? j.error ?? j.code;
  return typeof c === 'string' ? c.slice(0, 80) : null;
}

export async function chamarMP<T>(
  config: Pick<ConfigMP, 'accessToken'>,
  caminho: string,
  opcoes: { metodo?: 'GET' | 'POST'; corpo?: unknown; chaveIdempotencia?: string; tempoMaxMs?: number; escopo: string },
): Promise<RespostaMP<T>> {
  const metodo = opcoes.metodo ?? 'GET';
  if (metodo === 'POST' && !opcoes.chaveIdempotencia) throw new Error('mutação no Mercado Pago sem X-Idempotency-Key');
  const cabecalhos: Record<string, string> = { Authorization: `Bearer ${config.accessToken}`, Accept: 'application/json' };
  if (opcoes.corpo !== undefined) cabecalhos['Content-Type'] = 'application/json';
  if (opcoes.chaveIdempotencia) cabecalhos['X-Idempotency-Key'] = opcoes.chaveIdempotencia;
  let r: Response;
  try {
    r = await fetch(`${API_MP}${caminho}`, {
      method: metodo,
      headers: cabecalhos,
      body: opcoes.corpo === undefined ? undefined : JSON.stringify(opcoes.corpo),
      signal: AbortSignal.timeout(opcoes.tempoMaxMs ?? TEMPO_MAXIMO_MS),
      cache: 'no-store',
    });
  } catch (e) {
    log.error(opcoes.escopo, 'Mercado Pago sem resposta', { erro: e instanceof Error ? e.name : 'desconhecido' });
    return { ok: false, transitorio: true, status: null, codigo: null };
  }
  let json: unknown = null;
  try {
    json = await r.json();
  } catch {
    json = null;
  }
  if (r.ok && json !== null) return { ok: true, status: r.status, dados: json as T };
  const transitorio = r.status >= 500 || r.status === 423 || r.status === 429 || r.ok;
  const codigoErro = codigoDoErro(json);
  log.error(opcoes.escopo, 'Mercado Pago recusou', { status: r.status, codigoErro });
  return { ok: false, transitorio, status: r.status, codigo: codigoErro };
}
