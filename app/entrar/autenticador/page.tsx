import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { clienteServidor } from '@/lib/supabase/servidor';
import { lerSegundoFator } from '@/lib/seguranca/area';
import { comVolta, destinoDepoisDoLogin, destinoSeguro } from '@/lib/seguranca/destino';
import { CASA_DO_PAPEL } from '@/lib/seguranca/papeis';
import { log } from '@/lib/observabilidade/logger';
import { SemAcesso } from '@/components/sem-acesso';
import { FormularioAtivacao, FormularioDesafio } from './formulario';

export const metadata: Metadata = { title: 'Código do autenticador', robots: { index: false } };

// Tela do segundo fator da dona (tela 9, estados "Dona: autenticador" e "Dona: ativar autenticador").
// Mora fora de /admin: a guarda do painel manda para cá sem laço (04, 2.1). Mesmas regras da guarda:
// papel de perfis.papel; perfil ou nível ilegível explica, não redireciona (04, 2.2).
export default async function Autenticador({ searchParams }: PageProps<'/entrar/autenticador'>) {
  const volta = destinoSeguro((await searchParams).volta) ?? undefined;
  const supabase = await clienteServidor();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect(comVolta('/entrar', volta));

  const { data: perfil, error } = await supabase.from('perfis').select('papel').eq('id', data.user.id).maybeSingle();
  if (error) {
    log.error('auth.totp', 'falha ao ler perfil', { codigo: error.code });
    return <SemAcesso causa="erro-ao-ler-perfil" />;
  }
  if (perfil?.papel !== 'admin') {
    // O comprador não tem segundo fator: vai para a casa dele, nunca para o painel.
    const casa = destinoDepoisDoLogin({ volta: undefined, papel: perfil?.papel });
    if (!casa) return <SemAcesso causa="sem-papel" />;
    redirect(casa);
  }

  const fator = await lerSegundoFator(supabase);
  if (fator.erroAoLer) return <SemAcesso causa="erro-ao-ler-perfil" />;
  if (fator.nivel === 'aal2') redirect(destinoDepoisDoLogin({ volta, papel: 'admin' }) ?? CASA_DO_PAPEL.admin);
  return fator.temFator ? <FormularioDesafio volta={volta} /> : <FormularioAtivacao volta={volta} />;
}
