import { describe, expect, it } from 'vitest';
import { ERROS_ACESSO, MENSAGENS, normalizarCodigo, respostaDeFaltaConfirmar, respostaDoCadastro, respostaDoCodigo, respostaDoLogin, respostaDoReenvio, respostaDoTotp } from './acesso';

const EMAIL = 'ana@exemplo.test';
const AGORA = 1_700_000_000_000;

describe('anti-enumeração (04, 2.5; regra 6)', () => {
  it('cadastro: e-mail novo e e-mail que já tem conta dão a MESMA resposta', () => {
    const novo = respostaDoCadastro(EMAIL, undefined, AGORA);
    expect(novo).toEqual({ etapa: 'codigo', email: EMAIL, aviso: MENSAGENS.codigoEnviado, enviadoEm: AGORA });
    // identities vazio chega como sucesso (undefined); com "Confirm email" desligado, como erro.
    expect(respostaDoCadastro(EMAIL, 'user_already_exists', AGORA)).toEqual(novo);
    expect(respostaDoCadastro(EMAIL, 'email_exists', AGORA)).toEqual(novo);
  });

  it('o texto do código não afirma que o e-mail recebeu nada nem que a conta existe', () => {
    expect(MENSAGENS.codigoEnviado).toMatch(/^Se este e-mail ainda não tem conta/);
    expect(MENSAGENS.reenviado).toMatch(/^Se houver um cadastro/);
  });

  it('reenvio: uma resposta só, qualquer que seja o e-mail', () => {
    expect(respostaDoReenvio(EMAIL, AGORA)).toEqual({ etapa: 'codigo', email: EMAIL, aviso: MENSAGENS.reenviado, enviadoEm: AGORA });
  });

  it('o que não depende do e-mail tem mensagem própria: senha fraca e limite de tentativas', () => {
    expect(respostaDoCadastro(EMAIL, 'weak_password', AGORA).erro).toEqual(ERROS_ACESSO.senhaFraca);
    expect(respostaDoCadastro(EMAIL, 'over_email_send_rate_limit', AGORA).erro).toEqual(ERROS_ACESSO.limite);
    expect(respostaDoCadastro(EMAIL, 'unexpected_failure', AGORA).erro).toEqual(ERROS_ACESSO.geral);
  });
});

describe('login e códigos', () => {
  it('senha errada e conta inexistente dão a mesma mensagem', () => {
    expect(respostaDoLogin(EMAIL, 'invalid_credentials')).toEqual({ etapa: 'credenciais', email: EMAIL, erro: ERROS_ACESSO.credenciais });
  });

  it('e-mail não confirmado (só chega com a senha certa) leva ao código', () => {
    expect(respostaDoLogin(EMAIL, 'email_not_confirmed')).toBe('confirmar-email');
  });

  it('e-mail não confirmado: só diz "Enviamos" se o reenvio deu certo (o que a tela promete é verdade)', () => {
    expect(respostaDeFaltaConfirmar(EMAIL, undefined, AGORA)).toEqual({ etapa: 'codigo', email: EMAIL, aviso: MENSAGENS.faltaConfirmar, enviadoEm: AGORA });
    for (const erro of ['over_email_send_rate_limit', 'unexpected_failure']) {
      const r = respostaDeFaltaConfirmar(EMAIL, erro, AGORA);
      expect(r.aviso, erro).toBe(MENSAGENS.faltaConfirmarSemEnvio);
      expect(r.aviso, erro).not.toMatch(/Enviamos/);
    }
  });

  it('código errado ou vencido: diz o que fazer e fica na etapa do código', () => {
    expect(respostaDoCodigo(EMAIL, 'otp_expired')).toEqual({ etapa: 'codigo', email: EMAIL, erro: ERROS_ACESSO.codigo });
    expect(ERROS_ACESSO.codigo.texto).toMatch(/peça um código novo/);
  });

  it('TOTP errado lembra do relógio do celular', () => {
    expect(respostaDoTotp('mfa_verification_failed')).toEqual(ERROS_ACESSO.totp);
    expect(respostaDoTotp('over_request_rate_limit')).toEqual(ERROS_ACESSO.limite);
  });

  it('normalizarCodigo aceita os 6 números com espaço ou hífen e recusa o resto', () => {
    expect(normalizarCodigo('123456')).toBe('123456');
    expect(normalizarCodigo(' 123 456 ')).toBe('123456');
    expect(normalizarCodigo('123-456')).toBe('123456');
    for (const mal of ['12345', '1234567', 'abcdef', '12345a', '', null, 123456]) expect(normalizarCodigo(mal), String(mal)).toBeNull();
  });
});
