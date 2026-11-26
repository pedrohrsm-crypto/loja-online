// Assinatura da notificação do Mercado Pago (cabeçalho `x-signature`), L4.
//
// Fontes (conferidas em 4-Nov-2026):
// - "Configurar notificações" do Checkout Transparente via Orders API, aba "Sem SDKs":
//   https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/notifications
//   O cabeçalho é `ts=<ts>,v1=<hex>`; o HMAC-SHA256, em hexadecimal, com a assinatura secreta da
//   aplicação, é sobre o MANIFEST `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`, onde `data.id`
//   vem da query string e, se alfanumérico, vai em minúsculas; o par que faltar sai do manifest.
//   A mesma página diz que `ts` é em MILISSEGUNDOS (exemplo `ts=1742505638683`).
// - SDK oficial Node `mercadopago` 3.6.1 (`dist/utils/webhook/index.js`): monta o mesmo manifest, mas
//   usa o `data.id` como chegou e trata `ts` em segundos.
// As duas fontes divergem em dois pontos, e errar aqui recusa TODA notificação. Por isso: aceita o
// manifest com o `data.id` em minúsculas OU como chegou (as duas exigem o segredo; nenhuma enfraquece a
// prova), e lê `ts` em milissegundos quando tem 13 dígitos ou mais, em segundos quando tem menos.
//
// O CORPO NÃO É ASSINADO: nada do corpo decide estado. Quem decide é o GET /v1/orders/{id}.
import { createHmac, timingSafeEqual } from 'node:crypto';

export const TOLERANCIA_SEGUNDOS = 300;

export type MotivoAssinatura = 'sem-cabecalho' | 'malformado' | 'nao-confere' | 'fora-da-tolerancia';

export function lerCabecalho(cabecalho: string): { ts: string | null; v1: string | null } {
  let ts: string | null = null;
  let v1: string | null = null;
  for (const parte of cabecalho.split(',')) {
    const i = parte.indexOf('=');
    if (i <= 0) continue;
    const chave = parte.slice(0, i).trim().toLowerCase();
    const valor = parte.slice(i + 1).trim();
    if (!valor) continue;
    if (chave === 'ts') ts = valor;
    else if (chave === 'v1') v1 = valor;
  }
  return { ts, v1 };
}

export function manifest(dataId: string | null, requestId: string | null, ts: string): string {
  const partes: string[] = [];
  if (dataId) partes.push(`id:${dataId}`);
  if (requestId) partes.push(`request-id:${requestId}`);
  partes.push(`ts:${ts}`);
  return `${partes.join(';')};`;
}

export function assinar(texto: string, segredo: string): string {
  return createHmac('sha256', segredo).update(texto).digest('hex');
}

/** `ts` do cabeçalho em milissegundos: 13 dígitos ou mais já é ms; menos que isso, segundos. */
export function tsEmMs(ts: string): number {
  const n = Number(ts);
  return ts.length >= 13 ? n : n * 1000;
}

function iguais(hexA: string, hexB: string): boolean {
  const a = Buffer.from(hexA, 'utf8');
  const b = Buffer.from(hexB.toLowerCase(), 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

export function verificarAssinatura(p: {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string | null;
  segredo: string;
  agoraMs?: number;
  toleranciaS?: number;
}): { ok: true } | { ok: false; motivo: MotivoAssinatura } {
  if (!p.xSignature?.trim()) return { ok: false, motivo: 'sem-cabecalho' };
  const { ts, v1 } = lerCabecalho(p.xSignature);
  if (!ts || !v1 || !/^\d{1,16}$/.test(ts) || !/^[0-9a-f]{64}$/i.test(v1)) return { ok: false, motivo: 'malformado' };
  const requestId = p.xRequestId?.trim() || null;
  const dataId = p.dataId?.trim() || null;
  const candidatos = new Set([dataId?.toLowerCase() ?? null, dataId]);
  // Compara todos os candidatos, sem sair no primeiro: o tempo não diz qual bateu.
  let confere = false;
  for (const id of candidatos) if (iguais(assinar(manifest(id, requestId, ts), p.segredo), v1)) confere = true;
  if (!confere) return { ok: false, motivo: 'nao-confere' };
  const deriva = Math.abs((p.agoraMs ?? Date.now()) - tsEmMs(ts)) / 1000;
  if (deriva > (p.toleranciaS ?? TOLERANCIA_SEGUNDOS)) return { ok: false, motivo: 'fora-da-tolerancia' };
  return { ok: true };
}
