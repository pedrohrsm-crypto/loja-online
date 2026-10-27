'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { clienteServidor } from '@/lib/supabase/servidor';
import { clienteAdmin } from '@/lib/supabase/admin';
import { escrever } from '@/lib/supabase/escrever';
import { iniciarCheckout } from '@/lib/pagamentos/checkout';
import { PRODUTOS } from '@/lib/pagamentos/produtos';
import { log } from '@/lib/observabilidade/logger';

export type Estado = { erro?: string; ok?: string; nome?: string };

async function usuarioAtual() {
  const supabase = await clienteServidor();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/entrar');
  return { supabase, usuario: data.user };
}

export async function comprar(_a: Estado, dados: FormData): Promise<Estado> {
  const { usuario } = await usuarioAtual();
  const produto = PRODUTOS[String(dados.get('produto'))];
  if (!produto) return { erro: 'Produto inválido.' };
  const h = await headers();
  const origem = process.env.NEXT_PUBLIC_SITE_URL ?? `https://${h.get('host')}`;
  const r = await iniciarCheckout(clienteAdmin(), { usuarioId: usuario.id, email: usuario.email ?? null, produto, origem });
  if (!r.ok) return { erro: r.mensagem };
  redirect(r.url);
}

export async function salvarNome(_a: Estado, dados: FormData): Promise<Estado> {
  const { supabase, usuario } = await usuarioAtual();
  const nome = String(dados.get('nome') ?? '').trim();
  if (nome.length > 120) return { erro: 'O nome pode ter até 120 caracteres.', nome };
  const r = await escrever(supabase.from('perfis').update({ nome }).eq('id', usuario.id).select('id'), {
    esperado: 1, escopo: 'conta.salvar-nome', contexto: { usuario: usuario.id },
  });
  if (!r.ok) return { erro: 'Não foi possível salvar. Tente de novo.', nome };
  revalidatePath('/conta');
  return { ok: 'Nome salvo.', nome };
}

export async function excluirConta(_a: Estado, dados: FormData): Promise<Estado> {
  const { supabase, usuario } = await usuarioAtual();
  if (String(dados.get('confirmacao') ?? '').trim().toUpperCase() !== 'EXCLUIR') {
    return { erro: 'Digite EXCLUIR para confirmar.' };
  }
  const admin = clienteAdmin();
  // Pedido aberto não pode ser pago depois que a conta sumir.
  const cancelou = await admin.from('pedidos').update({ status: 'cancelado' }).eq('usuario_id', usuario.id).eq('status', 'aberto').select('id');
  if (cancelou.error) {
    log.error('conta.excluir', 'falha ao cancelar pedidos abertos', { codigo: cancelou.error.code });
    return { erro: 'Não foi possível excluir a conta agora. Tente de novo.' };
  }
  // Assinatura recorrente (módulo Pagamentos, variante assinatura): cancelar no processador AQUI, antes.
  const { error } = await admin.auth.admin.deleteUser(usuario.id);
  if (error) {
    log.error('conta.excluir', 'falha ao excluir usuário', { codigo: error.code });
    return { erro: 'Não foi possível excluir a conta agora. Tente de novo.' };
  }
  await supabase.auth.signOut();
  redirect('/?conta=excluida');
}

export async function sair(): Promise<void> {
  const { supabase } = await usuarioAtual();
  await supabase.auth.signOut();
  redirect('/');
}
