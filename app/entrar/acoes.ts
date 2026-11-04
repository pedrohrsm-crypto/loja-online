'use server';

// Tela 9: entrar, criar conta e confirmar o e-mail com o código de 6 dígitos na mesma tela (D-LO-6,
// #11). As respostas moram em lib/seguranca/acesso.ts; o destino depois de entrar, em
// lib/seguranca/destino.ts (#24). Nenhum e-mail, senha ou código vai para o log: só o código do erro.
//
// Como o código funciona nesta versão (@supabase/auth-js 2.117.2, src/GoTrueClient.ts):
// - signUp() com "Confirm email" ligado devolve o usuário sem sessão, e o e-mail de confirmação leva
//   o código se o modelo tiver `{{ .Token }}` (a doc de signInWithOtp: "If the `{{ .Token }}` variable
//   is specified in the email template, an OTP will be sent").
// - verifyOtp({ email, token, type: 'email' }) confere o código e devolve a sessão (o tipo `signup`
//   está marcado como obsoleto na doc).
// - resend({ type: 'signup', email }) reenvia o e-mail de confirmação.
import { redirect } from 'next/navigation';
import { clienteServidor } from '@/lib/supabase/servidor';
import { log } from '@/lib/observabilidade/logger';
import {
  MENSAGENS,
  normalizarCodigo,
  respostaDoCadastro,
  respostaDeFaltaConfirmar,
  respostaDoCodigo,
  respostaDoLogin,
  respostaDoReenvio,
  type EstadoAcesso,
} from '@/lib/seguranca/acesso';
import { destinoDepoisDoLogin } from '@/lib/seguranca/destino';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Cliente = Awaited<ReturnType<typeof clienteServidor>>;

/** Depois de a sessão existir: a volta validada, ou a casa do papel lido em perfis.papel. */
async function irParaODestino(supabase: Cliente, usuarioId: string, volta: unknown, email: string): Promise<EstadoAcesso> {
  const { data: perfil, error } = await supabase.from('perfis').select('papel').eq('id', usuarioId).maybeSingle();
  if (error) log.error('auth.destino', 'falha ao ler perfil', { codigo: error.code });
  const destino = destinoDepoisDoLogin({ volta, papel: error ? undefined : perfil?.papel });
  if (!destino) return { etapa: 'credenciais', email, erro: { titulo: 'Quase lá', texto: MENSAGENS.entrouSemPerfil } };
  redirect(destino);
}

export async function acessar(_anterior: EstadoAcesso, dados: FormData): Promise<EstadoAcesso> {
  const intencao = String(dados.get('intencao') ?? 'entrar');
  const email = String(dados.get('email') ?? '').trim();
  const volta = dados.get('volta');
  if (!EMAIL.test(email)) return { etapa: intencao === 'confirmar' || intencao === 'reenviar' ? 'codigo' : 'credenciais', email, erro: { titulo: MENSAGENS.emailInvalido, texto: '' } };
  const supabase = await clienteServidor();

  if (intencao === 'reenviar') {
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    if (error) log.warn('auth.reenviar', 'reenvio recusado', { codigo: error.code });
    return respostaDoReenvio(email, Date.now());
  }

  if (intencao === 'confirmar') {
    const codigo = normalizarCodigo(dados.get('codigo'));
    if (!codigo) return { etapa: 'codigo', email, erro: { titulo: MENSAGENS.codigoFormato, texto: '' } };
    const { data, error } = await supabase.auth.verifyOtp({ email, token: codigo, type: 'email' });
    if (error || !data.user || !data.session) {
      log.info('auth.codigo', 'código recusado', { codigo: error?.code });
      return respostaDoCodigo(email, error?.code);
    }
    return irParaODestino(supabase, data.user.id, volta, email);
  }

  const senha = String(dados.get('senha') ?? '');
  if (senha.length < 8) return { etapa: 'credenciais', email, erro: { titulo: MENSAGENS.senhaCurta, texto: '' } };

  if (intencao === 'cadastro') {
    const { data, error } = await supabase.auth.signUp({ email, password: senha });
    if (error) log.warn('auth.cadastro', 'cadastro recusado', { codigo: error.code });
    // Com "Confirm email" desligado no painel, o cadastro já volta com sessão: segue para o destino.
    if (!error && data.user && data.session) return irParaODestino(supabase, data.user.id, volta, email);
    return respostaDoCadastro(email, error?.code, Date.now());
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error || !data.user) {
    log.info('auth.entrar', 'login recusado', { codigo: error?.code });
    const resposta = respostaDoLogin(email, error?.code);
    if (resposta !== 'confirmar-email') return resposta;
    const reenvio = await supabase.auth.resend({ type: 'signup', email });
    if (reenvio.error) log.warn('auth.reenviar', 'reenvio recusado', { codigo: reenvio.error.code });
    return respostaDeFaltaConfirmar(email, reenvio.error?.code, Date.now());
  }
  return irParaODestino(supabase, data.user.id, volta, email);
}
