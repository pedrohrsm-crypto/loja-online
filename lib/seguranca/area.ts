// Leitura do usuário, do perfil e (no painel) do segundo fator para uma área, e a decisão da guarda.
// Chamada no layout E em cada página: o layout não re-renderiza na navegação nem impede a página de
// rodar (04, 2.9). O cache() do React faz layout e página dividirem a mesma leitura na mesma requisição.
import { cache } from 'react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { clienteServidor } from '@/lib/supabase/servidor';
import { CABECALHO_CAMINHO, comVolta } from './destino';
import { exigeSegundoFator, guardaArea, type Resultado, type SegundoFator } from './guarda-area';
import type { Papel } from './papeis';
import { log } from '@/lib/observabilidade/logger';

type ClienteServidor = Awaited<ReturnType<typeof clienteServidor>>;

export async function caminhoPedido(): Promise<string | null> {
  return (await headers()).get(CABECALHO_CAMINHO);
}

/**
 * `aal` da sessão, conferido no servidor do Auth: o JWT vai para `getAuthenticatorAssuranceLevel(jwt)`,
 * que chama `getUser(jwt)` antes de confiar no `aal` (node_modules/@supabase/auth-js/src/GoTrueClient.ts,
 * `_getAuthenticatorAssuranceLevel`). Sem o JWT, a função leria o cookie sem conferir.
 */
export async function lerSegundoFator(supabase: ClienteServidor): Promise<SegundoFator & { temFator: boolean }> {
  const { data: sessao, error: erroSessao } = await supabase.auth.getSession();
  const jwt = sessao.session?.access_token;
  if (erroSessao || !jwt) {
    log.error('area.segundo-fator', 'sessão sem token', { codigo: erroSessao?.code });
    return { nivel: null, erroAoLer: true, temFator: false };
  }
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel(jwt);
  if (error || !data) {
    log.error('area.segundo-fator', 'falha ao ler o nível da sessão', { codigo: error?.code });
    return { nivel: null, erroAoLer: true, temFator: false };
  }
  return { nivel: data.currentLevel, temFator: data.nextLevel === 'aal2' };
}

export const entrarNaArea = cache(async (area: Papel): Promise<{ resultado: Resultado; usuarioId: string; email: string | null }> => {
  const supabase = await clienteServidor();
  const caminho = await caminhoPedido();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect(comVolta('/entrar', caminho));
  const { data: perfil, error } = await supabase.from('perfis').select('papel').eq('id', data.user.id).maybeSingle();
  if (error) log.error('area.perfil', 'falha ao ler perfil', { codigo: error.code });
  // O nível só é lido quando decide algo: papel da área que exige o segundo fator.
  const segundoFator = !error && exigeSegundoFator(area) && perfil?.papel === area ? await lerSegundoFator(supabase) : undefined;
  const resultado = guardaArea({ perfil, erroAoLer: Boolean(error), area, segundoFator, caminho });
  if (resultado.tipo === 'redirecionar') redirect(resultado.destino);
  return { resultado, usuarioId: data.user.id, email: data.user.email ?? null };
});
