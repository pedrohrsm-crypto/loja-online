// Cliente mínimo da API REST do Stripe, sem SDK: POST em form-urlencoded, versão da API
// fixada (04, erro 3.2), Idempotency-Key em toda mutação e tempo máximo em toda chamada.
const API = 'https://api.stripe.com/v1';

export type ResultadoStripe<T> = { ok: true; dados: T } | { ok: false; erro: string; status?: number };

export function modoDaChave(chave: string | null | undefined): 'teste' | 'producao' {
  return /^[a-z]+_test_/i.test(chave ?? '') ? 'teste' : 'producao';
}

export async function stripe<T>(
  caminho: string,
  opcoes: { metodo?: 'GET' | 'POST'; corpo?: Record<string, string | number | undefined>; chaveIdempotencia?: string; tempoMaxMs?: number } = {},
): Promise<ResultadoStripe<T>> {
  const chave = process.env.STRIPE_SECRET_KEY;
  if (!chave) return { ok: false, erro: 'STRIPE_SECRET_KEY ausente' };
  const cabecalhos: Record<string, string> = { Authorization: `Bearer ${chave}` };
  if (process.env.STRIPE_API_VERSION) cabecalhos['Stripe-Version'] = process.env.STRIPE_API_VERSION;
  let corpo: string | undefined;
  if (opcoes.corpo) {
    cabecalhos['Content-Type'] = 'application/x-www-form-urlencoded';
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(opcoes.corpo)) if (v !== undefined) p.append(k, String(v));
    corpo = p.toString();
  }
  if (opcoes.chaveIdempotencia) cabecalhos['Idempotency-Key'] = opcoes.chaveIdempotencia;
  try {
    const r = await fetch(`${API}${caminho}`, {
      method: opcoes.metodo ?? 'GET',
      headers: cabecalhos,
      body: corpo,
      signal: AbortSignal.timeout(opcoes.tempoMaxMs ?? 10_000),
    });
    const json = (await r.json()) as T & { error?: { message: string } };
    if (!r.ok) return { ok: false, erro: json.error?.message ?? `Stripe ${r.status}`, status: r.status };
    return { ok: true, dados: json };
  } catch (e) {
    return { ok: false, erro: `falha de rede no Stripe: ${e instanceof Error ? e.message : 'desconhecida'}` };
  }
}
