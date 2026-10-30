// Carregado com NODE_OPTIONS=--require no servidor do e2e (playwright.config.ts): desvia toda chamada
// a *.supabase.co para o Supabase falso (e2e/apoio/supabase-falso.mjs). Existe porque o proxy.ts lê
// NEXT_PUBLIC_SUPABASE_URL em tempo de build (a variável é embutida no pacote): trocar a URL só na
// execução não alcançaria o proxy, e o CI constrói com https://exemplo.supabase.co. Só o e2e usa isto.
const ALVO = `http://127.0.0.1:${process.env.SUPABASE_FALSO_PORTA ?? 3101}`;
const original = globalThis.fetch;

globalThis.fetch = function fetchDesviado(entrada, init) {
  try {
    const texto = typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
    const u = new URL(texto);
    if (u.hostname.endsWith('.supabase.co')) {
      const novo = `${ALVO}${u.pathname}${u.search}`;
      return original(typeof entrada === 'object' && 'url' in entrada ? new Request(novo, entrada) : novo, init);
    }
  } catch {
    // URL que não é absoluta: segue como veio.
  }
  return original(entrada, init);
};
