// Apoio de teste: um cliente do Supabase falso que grava a cadeia de cada consulta (from, select,
// eq, not, is, update…) e responde com o que o teste mandou. Só os testes importam este arquivo.
import type { SupabaseClient } from '@supabase/supabase-js';

export type Passo = [metodo: string, ...args: unknown[]];
export type Resposta = { data: unknown; error: { code?: string; message: string } | null };

export function bancoFalso(responder: (cadeia: Passo[]) => Resposta) {
  const consultas: Passo[][] = [];
  const chamadas: Array<{ fn: string; args: unknown }> = [];
  let rpc: (fn: string, args: unknown) => Resposta = () => ({ data: null, error: null });
  const consulta = (cadeia: Passo[]): unknown =>
    new Proxy({}, {
      get(_alvo, prop) {
        if (prop === 'then') {
          consultas.push(cadeia);
          const r = responder(cadeia);
          return (ok: (v: Resposta) => unknown) => Promise.resolve(r).then(ok);
        }
        return (...args: unknown[]) => consulta([...cadeia, [String(prop), ...args]]);
      },
    });
  const db = {
    from: (tabela: string) => consulta([['from', tabela]]),
    rpc: async (fn: string, args: unknown) => (chamadas.push({ fn, args }), rpc(fn, args)),
    auth: { admin: { deleteUser: async () => ({ error: null }) } },
  };
  return {
    db: db as unknown as SupabaseClient,
    consultas,
    chamadas,
    aoChamar(f: (fn: string, args: unknown) => Resposta) { rpc = f; },
  };
}

// A cadeia contém o passo (método com estes argumentos)?
export function tem(cadeia: Passo[], ...passo: Passo): boolean {
  return cadeia.some((p) => p.length === passo.length && p.every((x, i) => x === passo[i]));
}
