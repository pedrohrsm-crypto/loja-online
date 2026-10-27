// Leitura do usuário e do perfil para uma área, e a decisão da guarda. Chamada no layout E em
// cada página: o layout não re-renderiza na navegação nem impede a página de rodar (04, 2.9).
// O cache() do React faz layout e página dividirem a mesma leitura na mesma requisição.
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { clienteServidor } from '@/lib/supabase/servidor';
import { guardaArea, type Resultado } from './guarda-area';
import type { Papel } from './papeis';
import { log } from '@/lib/observabilidade/logger';

export const entrarNaArea = cache(async (area: Papel): Promise<{ resultado: Resultado; usuarioId: string; email: string | null }> => {
  const supabase = await clienteServidor();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/entrar');
  const { data: perfil, error } = await supabase.from('perfis').select('papel').eq('id', data.user.id).maybeSingle();
  if (error) log.error('area.perfil', 'falha ao ler perfil', { codigo: error.code });
  const resultado = guardaArea({ perfil, erroAoLer: Boolean(error), area });
  if (resultado.tipo === 'redirecionar') redirect(resultado.destino);
  return { resultado, usuarioId: data.user.id, email: data.user.email ?? null };
});
