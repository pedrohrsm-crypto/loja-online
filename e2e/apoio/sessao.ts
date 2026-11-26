// Sessão do Supabase falso (e2e/apoio/supabase-falso.mjs): o cookie que o @supabase/ssr lê, com um
// token no formato de JWT cujo `sub` e `aal` o falso reconhece. Um lugar só para os specs.
import type { BrowserContext } from '@playwright/test';

export const IDS = {
  admin: '00000000-0000-4000-8000-0000000000a1',
  'dona-nova': '00000000-0000-4000-8000-0000000000a2',
  cliente: '00000000-0000-4000-8000-0000000000c1',
  // Comprador só do teste da reserva própria (#32): nenhum outro spec semeia pedido aberto para ele.
  novo: '00000000-0000-4000-8000-0000000000c3',
} as const;

export type Quem = keyof typeof IDS;

const b64 = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString('base64url');

export function tokenFalso(quem: Quem, aal: 'aal1' | 'aal2'): string {
  const carga = { sub: IDS[quem], aud: 'authenticated', role: 'authenticated', aal, exp: 4102444800, session_id: 'sessao-falsa' };
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(carga)}.${Buffer.from('assinatura-falsa').toString('base64url')}`;
}

// A dona entra com aal2 por padrão (o painel exige o segundo fator); o comprador, com aal1.
export async function entrarComo(context: BrowserContext, quem: Quem, aal: 'aal1' | 'aal2' = quem === 'cliente' || quem === 'novo' ? 'aal1' : 'aal2') {
  const sessao = {
    access_token: tokenFalso(quem, aal), refresh_token: 'renovacao', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800,
    user: { id: IDS[quem], aud: 'authenticated', role: 'authenticated', email: `${quem}@exemplo.test` },
  };
  const valor = 'base64-' + Buffer.from(JSON.stringify(sessao)).toString('base64url');
  // O nome do cookie vem do começo do domínio da URL do Supabase (convenção do @supabase/ssr).
  const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://exemplo.supabase.co').hostname.split('.')[0];
  await context.addCookies([{ name: `sb-${ref}-auth-token`, value: valor, domain: '127.0.0.1', path: '/' }]);
}
