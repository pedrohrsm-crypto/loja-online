// Proxy (Next 16; antes "middleware"): renova a sessão do Supabase e faz o redirecionamento
// OTIMISTA das rotas protegidas. A decisão final de acesso é do layout de cada área
// (lib/seguranca/guarda-area.ts), no servidor.
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { PREFIXOS_PROTEGIDOS } from '@/lib/seguranca/papeis';
import { redirecionarComCookies } from '@/lib/seguranca/redirecionar';

export async function proxy(request: NextRequest) {
  let resposta = NextResponse.next({ request });
  const caminho = request.nextUrl.pathname;
  const protegida = PREFIXOS_PROTEGIDOS.some((p) => caminho === p || caminho.startsWith(`${p}/`));

  // Sem cookie de sessão, não há o que renovar: nenhuma ida ao Supabase para o visitante.
  const temSessao = request.cookies.getAll().some((c) => c.name.startsWith('sb-'));
  if (!temSessao) {
    return protegida ? redirecionarComCookies(request, resposta, '/entrar') : resposta;
  }

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (lista) => {
        lista.forEach(({ name, value }) => request.cookies.set(name, value));
        resposta = NextResponse.next({ request });
        lista.forEach(({ name, value, options }) => resposta.cookies.set(name, value, options));
      },
    },
  });
  const { data } = await supabase.auth.getUser();
  if (!data.user && protegida) return redirecionarComCookies(request, resposta, '/entrar');
  return resposta;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/pagamentos/webhook).*)'],
};
