'use server';

// Segundo fator da dona (TOTP, `aal2`; FIDELIDADE.md §1, regra 1; S-03). Como funciona nesta versão
// (@supabase/auth-js 2.117.2, src/GoTrueClient.ts):
// - mfa.enroll({ factorType: 'totp' }) cria um fator NÃO verificado e devolve o QR (data URI SVG) e o
//   segredo; ele só vira "verified" no primeiro challenge + verify certo.
// - mfa.challengeAndVerify({ factorId, code }) confere o código e SALVA a sessão nova, com `aal: aal2`
//   no JWT (os cookies saem pelo setAll do cliente do servidor).
// - mfa.listFactors() lê os fatores pelo getUser(): `totp` só traz os verificados; `all`, todos.
// Só a dona (perfis.papel = 'admin', nunca user_metadata) chega aqui; o comprador não tem fator.
import { redirect } from 'next/navigation';
import { clienteServidor } from '@/lib/supabase/servidor';
import { log } from '@/lib/observabilidade/logger';
import { ERROS_ACESSO, MENSAGENS, normalizarCodigo, respostaDoTotp } from '@/lib/seguranca/acesso';
import { destinoDepoisDoLogin } from '@/lib/seguranca/destino';
import { CASA_DO_PAPEL } from '@/lib/seguranca/papeis';

export type EstadoTotp = { erro?: { titulo: string; texto: string }; ativacao?: { fatorId: string; qr: string; segredo: string } };

const EMISSOR = 'Ateliê Alecrim';

async function sessaoDaDona() {
  const supabase = await clienteServidor();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/entrar');
  const { data: perfil, error } = await supabase.from('perfis').select('papel').eq('id', data.user.id).maybeSingle();
  if (error) {
    log.error('auth.totp', 'falha ao ler perfil', { codigo: error.code });
    return null;
  }
  return perfil?.papel === 'admin' ? supabase : null;
}

export async function autenticador(anterior: EstadoTotp, dados: FormData): Promise<EstadoTotp> {
  const intencao = String(dados.get('intencao') ?? '');
  const supabase = await sessaoDaDona();
  if (!supabase) return { erro: ERROS_ACESSO.geral };

  const { data: fatores, error: erroFatores } = await supabase.auth.mfa.listFactors();
  if (erroFatores || !fatores) {
    log.error('auth.totp', 'falha ao listar fatores', { codigo: erroFatores?.code });
    return { ...anterior, erro: ERROS_ACESSO.geral };
  }

  if (intencao === 'iniciar') {
    if (fatores.totp.length > 0) return { erro: { titulo: 'O autenticador já está ativo', texto: 'Recarregue a página e digite o código que aparece no aplicativo.' } };
    // Fator que ficou sem verificar (QR aberto e abandonado) sai antes do novo: o nome do fator é único.
    for (const f of fatores.all.filter((x) => x.factor_type === 'totp' && x.status === 'unverified')) {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: f.id });
      if (error) log.warn('auth.totp', 'falha ao remover fator não verificado', { codigo: error.code });
    }
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', issuer: EMISSOR, friendlyName: 'Painel Alecrim' });
    if (error || !data) {
      log.error('auth.totp', 'falha ao criar o fator', { codigo: error?.code });
      return { erro: ERROS_ACESSO.geral };
    }
    return { ativacao: { fatorId: data.id, qr: data.totp.qr_code, segredo: data.totp.secret } };
  }

  const codigo = normalizarCodigo(dados.get('codigo'));
  if (!codigo) return { ...anterior, erro: { titulo: MENSAGENS.codigoFormato, texto: '' } };

  // O fator vem da lista do servidor, nunca só do formulário: na ativação, o id enviado tem de ser
  // um fator TOTP não verificado DESTA conta; no desafio, é o verificado.
  const pedido = String(dados.get('fator') ?? '');
  const fator =
    intencao === 'ativar'
      ? fatores.all.find((f) => f.id === pedido && f.factor_type === 'totp' && f.status === 'unverified')
      : fatores.totp[0];
  if (!fator) return { erro: ERROS_ACESSO.geral };

  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: fator.id, code: codigo });
  if (error) {
    log.info('auth.totp', 'código do autenticador recusado', { codigo: error.code });
    return { ...anterior, erro: respostaDoTotp(error.code) };
  }
  redirect(destinoDepoisDoLogin({ volta: dados.get('volta'), papel: 'admin' }) ?? CASA_DO_PAPEL.admin);
}
