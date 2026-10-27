'use server';

import { redirect } from 'next/navigation';
import { clienteServidor } from '@/lib/supabase/servidor';
import { log } from '@/lib/observabilidade/logger';

export type EstadoAcesso = { erro?: string; email?: string; aviso?: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function acessar(_anterior: EstadoAcesso, dados: FormData): Promise<EstadoAcesso> {
  const email = String(dados.get('email') ?? '').trim();
  const senha = String(dados.get('senha') ?? '');
  const modo = dados.get('modo') === 'cadastro' ? 'cadastro' : 'entrar';
  if (!EMAIL.test(email)) return { erro: 'Informe um e-mail válido.', email };
  if (senha.length < 8) return { erro: 'A senha precisa ter pelo menos 8 caracteres.', email };

  const supabase = await clienteServidor();
  if (modo === 'cadastro') {
    const { data, error } = await supabase.auth.signUp({ email, password: senha });
    if (error) {
      log.warn('auth.cadastro', 'cadastro recusado', { codigo: error.code });
      return { erro: 'Não foi possível criar a conta agora. Tente de novo.', email };
    }
    // Anti-enumeração do Supabase: e-mail já cadastrado volta "sucesso" com identities vazio
    // (04, erro 2.5). Dizer "confira seu e-mail" aqui mandaria esperar um e-mail que não vem.
    if (data.user && data.user.identities?.length === 0) {
      return { aviso: 'Este e-mail já tem conta. Entre com a sua senha.', email };
    }
    if (!data.session) return { aviso: 'Enviamos um link de confirmação para o seu e-mail.', email };
    redirect('/conta');
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) {
    log.info('auth.entrar', 'login recusado', { codigo: error.code });
    return { erro: 'E-mail ou senha incorretos.', email };
  }
  redirect('/conta');
}
