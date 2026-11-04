// Respostas da tela 9 (Entrar, criar conta, código de 6 dígitos e autenticador da dona). Puras: a
// Server Action só chama o Supabase e passa o código de erro para cá. Um lugar só para as regras
// de anti-enumeração (04, 2.5; FIDELIDADE.md §1, regra 6, S-07): cadastro e reenvio respondem
// IGUAL para e-mail com ou sem conta.

export type Etapa = 'credenciais' | 'codigo';

export type EstadoAcesso = {
  etapa?: Etapa;
  email?: string;
  erro?: { titulo: string; texto: string };
  aviso?: string;
  /** Muda a cada envio de código: reinicia a espera do "Reenviar". */
  enviadoEm?: number;
};

/** Espera entre dois envios. O Supabase recusa mais de um pedido por e-mail a cada 60 s. */
export const ESPERA_REENVIO_S = 60;

const LIMITE = new Set(['over_email_send_rate_limit', 'over_request_rate_limit', 'too_many_requests']);

export const MENSAGENS = {
  emailInvalido: 'Informe um e-mail válido.',
  senhaCurta: 'A senha precisa ter pelo menos 8 caracteres.',
  codigoFormato: 'Digite os 6 números do código.',
  // Mesmo texto para e-mail novo e e-mail que já tem conta: só o primeiro recebe o código.
  codigoEnviado: 'Se este e-mail ainda não tem conta, enviamos para ele um código de 6 números. Digite aqui mesmo, sem sair desta página. Se você já tem conta, entre com a sua senha.',
  faltaConfirmar: 'Falta confirmar o seu e-mail. Enviamos um código de 6 números para ele: digite aqui mesmo.',
  // Quando o reenvio falhou (limite de 60 s, SMTP): não afirma que mandou nada.
  faltaConfirmarSemEnvio: 'Falta confirmar o seu e-mail. Se o código não chegar, peça um novo em 1 minuto.',
  reenviado: 'Se houver um cadastro esperando confirmação com esse e-mail, enviamos um código novo. Ele pode levar alguns minutos.',
  entrouSemPerfil: 'Você entrou, mas não conseguimos abrir a sua conta agora. Recarregue a página em alguns instantes.',
} as const;

const ERROS = {
  credenciais: { titulo: 'E-mail ou senha incorretos', texto: 'Confira e tente de novo.' },
  codigo: { titulo: 'Código incorreto ou vencido', texto: 'Confira os 6 números ou peça um código novo.' },
  senhaFraca: { titulo: 'Escolha outra senha', texto: 'Esta senha é fácil de adivinhar ou já apareceu em vazamentos. Use uma frase longa ou misture letras, números e símbolos.' },
  limite: { titulo: 'Muitas tentativas seguidas', texto: 'Aguarde alguns minutos e tente de novo.' },
  geral: { titulo: 'Não foi possível concluir agora', texto: 'Tente de novo em instantes.' },
  totp: { titulo: 'Código incorreto', texto: 'Confira o horário do celular e digite o código que aparece agora. Ele muda a cada 30 segundos.' },
} as const;

export type ErroAcesso = (typeof ERROS)[keyof typeof ERROS];

/** Os 6 números do código, aceitando espaço e hífen entre eles (quem cola "123 456"). */
export function normalizarCodigo(texto: unknown): string | null {
  if (typeof texto !== 'string') return null;
  const so = texto.replace(/[\s-]/g, '');
  return /^\d{6}$/.test(so) ? so : null;
}

/**
 * Resposta do cadastro. Sucesso, e-mail que já tem conta (`identities` vazio, ou `user_already_exists`
 * se a confirmação estiver desligada no painel) e qualquer outro caso que dependa do e-mail levam à
 * MESMA etapa do código, com o mesmo texto.
 */
export function respostaDoCadastro(email: string, codigoErro: string | undefined, agora: number): EstadoAcesso {
  if (codigoErro === 'weak_password') return { etapa: 'credenciais', email, erro: ERROS.senhaFraca };
  if (codigoErro && LIMITE.has(codigoErro)) return { etapa: 'credenciais', email, erro: ERROS.limite };
  if (codigoErro && codigoErro !== 'user_already_exists' && codigoErro !== 'email_exists') return { etapa: 'credenciais', email, erro: ERROS.geral };
  return { etapa: 'codigo', email, aviso: MENSAGENS.codigoEnviado, enviadoEm: agora };
}

/** Reenvio: a resposta não depende do erro (salvo nenhum), para não contar se o e-mail existe. */
export function respostaDoReenvio(email: string, agora: number): EstadoAcesso {
  return { etapa: 'codigo', email, aviso: MENSAGENS.reenviado, enviadoEm: agora };
}

/**
 * Login com a senha certa e o e-mail ainda sem confirmar: a tela só diz "Enviamos" se o reenvio
 * deu certo. Aqui a senha já provou a conta, então dizer que o envio falhou não enumera nada.
 */
export function respostaDeFaltaConfirmar(email: string, codigoErroReenvio: string | undefined, agora: number): EstadoAcesso {
  return { etapa: 'codigo', email, aviso: codigoErroReenvio ? MENSAGENS.faltaConfirmarSemEnvio : MENSAGENS.faltaConfirmar, enviadoEm: agora };
}

/** Erro do login com senha. `email_not_confirmed` só chega com a senha certa: aí vale pedir o código. */
export function respostaDoLogin(email: string, codigoErro: string | undefined): EstadoAcesso | 'confirmar-email' {
  if (codigoErro === 'email_not_confirmed') return 'confirmar-email';
  if (codigoErro && LIMITE.has(codigoErro)) return { etapa: 'credenciais', email, erro: ERROS.limite };
  if (codigoErro === 'invalid_credentials' || codigoErro === undefined) return { etapa: 'credenciais', email, erro: ERROS.credenciais };
  return { etapa: 'credenciais', email, erro: ERROS.geral };
}

export function respostaDoCodigo(email: string, codigoErro: string | undefined): EstadoAcesso {
  if (codigoErro && LIMITE.has(codigoErro)) return { etapa: 'codigo', email, erro: ERROS.limite };
  return { etapa: 'codigo', email, erro: ERROS.codigo };
}

export function respostaDoTotp(codigoErro: string | undefined): ErroAcesso {
  if (codigoErro && LIMITE.has(codigoErro)) return ERROS.limite;
  if (codigoErro === 'mfa_verification_failed' || codigoErro === 'mfa_challenge_expired' || codigoErro === undefined) return ERROS.totp;
  return ERROS.geral;
}

export { ERROS as ERROS_ACESSO };
