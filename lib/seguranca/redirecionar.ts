// Todo redirect do proxy passa por aqui: copia os cookies que a renovação da sessão acabou
// de escrever. Sem isso, o Supabase (que ROTACIONA o refresh token) deixa o navegador com um
// token já invalidado, e /entrar ⇄ /conta vira um laço (04, erro 2.1).
import { NextResponse, type NextRequest } from 'next/server';

export function redirecionarComCookies(request: NextRequest, resposta: NextResponse, destino: string): NextResponse {
  const r = NextResponse.redirect(new URL(destino, request.url));
  for (const c of resposta.cookies.getAll()) r.cookies.set(c);
  return r;
}
