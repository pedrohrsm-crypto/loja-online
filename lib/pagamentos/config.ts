// Configuração do Mercado Pago, lida e conferida num lugar só (L1).
//
// O modo de teste NÃO se deduz do prefixo da credencial: no Mercado Pago, as credenciais de teste e as
// de produção começam com `APP_USR` (doc de Pix pela Orders API, conferida em 4-Nov-2026; RISCOS §1).
// Por isso o modo vem de PAGAMENTO_MODO, explícito, e a loja recusa cobrar se ele faltar ou vier
// com outro valor. Variável faltando também recusa: nunca sobe "meio configurado".
export type ModoPagamento = 'teste' | 'producao';

export type ConfigMP = { modo: ModoPagamento; accessToken: string; segredoWebhook: string };

export type LeituraConfigMP = { ok: true; config: ConfigMP } | { ok: false; faltando: string[] };

type Ambiente = Record<string, string | undefined>;

export function lerConfigMP(env: Ambiente = process.env): LeituraConfigMP {
  const faltando: string[] = [];
  const modo = env.PAGAMENTO_MODO;
  if (modo !== 'teste' && modo !== 'producao') faltando.push('PAGAMENTO_MODO');
  const accessToken = env.MERCADOPAGO_ACCESS_TOKEN?.trim();
  if (!accessToken) faltando.push('MERCADOPAGO_ACCESS_TOKEN');
  const segredoWebhook = env.MERCADOPAGO_WEBHOOK_SECRET?.trim();
  if (!segredoWebhook) faltando.push('MERCADOPAGO_WEBHOOK_SECRET');
  if (faltando.length > 0 || !accessToken || !segredoWebhook) return { ok: false, faltando };
  return { ok: true, config: { modo: modo as ModoPagamento, accessToken, segredoWebhook } };
}
