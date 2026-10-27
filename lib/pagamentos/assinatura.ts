// Verificação do cabeçalho `Stripe-Signature` (https://docs.stripe.com/webhooks#verify-manually).
// Forma: `t=<unix>,v1=<hex>[,v1=<hex>…]`. Na rotação do segredo o Stripe manda DUAS `v1`
// (a do segredo antigo e a do novo): vale qualquer uma que bata, senão os eventos de
// cobrança real voltam 400 durante a janela de rotação.
import { createHmac, timingSafeEqual } from 'node:crypto';

export const TOLERANCIA_SEGUNDOS = 300;

export function lerCabecalho(cabecalho: string): { timestamp: number; assinaturas: string[] } {
  let timestamp = NaN;
  const assinaturas: string[] = [];
  for (const parte of cabecalho.split(',')) {
    const i = parte.indexOf('=');
    if (i <= 0) continue;
    const chave = parte.slice(0, i).trim();
    const valor = parte.slice(i + 1).trim();
    if (chave === 't') timestamp = parseInt(valor, 10);
    else if (chave === 'v1' && valor) assinaturas.push(valor);
  }
  return { timestamp, assinaturas };
}

export function assinar(corpo: string, segredo: string, timestamp: number): string {
  return createHmac('sha256', segredo).update(`${timestamp}.${corpo}`).digest('hex');
}

export function verificarAssinatura(corpo: string, cabecalho: string, segredo: string, agoraMs = Date.now()): boolean {
  const { timestamp, assinaturas } = lerCabecalho(cabecalho);
  if (!Number.isFinite(timestamp) || assinaturas.length === 0) return false;
  if (Math.abs(agoraMs / 1000 - timestamp) > TOLERANCIA_SEGUNDOS) return false; // replay
  const esperada = Buffer.from(assinar(corpo, segredo, timestamp), 'hex');
  return assinaturas.some((hex) => {
    const recebida = Buffer.from(hex, 'hex');
    return recebida.length === esperada.length && timingSafeEqual(esperada, recebida);
  });
}
