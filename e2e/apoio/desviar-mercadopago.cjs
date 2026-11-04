// Carregado com NODE_OPTIONS=--require no servidor do e2e (playwright.config.ts), DEPOIS do desvio do
// Supabase: leva toda chamada a api.mercadopago.com para o Mercado Pago falso (e2e/apoio/mercadopago-falso.mjs).
// O código de produção não tem URL configurável do Mercado Pago (lib/pagamentos/mercadopago.ts): só o
// e2e usa isto.
const ALVO = `http://127.0.0.1:${process.env.MERCADOPAGO_FALSO_PORTA ?? 3102}`;
const anterior = globalThis.fetch;

globalThis.fetch = function fetchDesviadoMP(entrada, init) {
  try {
    const texto = typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
    const u = new URL(texto);
    if (u.hostname === 'api.mercadopago.com') {
      const novo = `${ALVO}${u.pathname}${u.search}`;
      return anterior(typeof entrada === 'object' && 'url' in entrada ? new Request(novo, entrada) : novo, init);
    }
  } catch {
    // URL que não é absoluta: segue como veio.
  }
  return anterior(entrada, init);
};
