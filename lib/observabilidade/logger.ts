// Log estruturado: uma linha JSON por evento, sem fornecedor e sem dado pessoal.
//
// Módulo Privacidade (kit/freelance/modulos/privacidade-lgpd.md): o log nunca leva
// e-mail, CPF, telefone, token ou senha. A redação é pela CHAVE (segredos) e pelo
// VALOR (e-mail, CPF e telefone em qualquer string), porque o dado pessoal chega
// dentro de mensagens de erro do banco com nomes de campo inocentes.

export type NivelLog = 'debug' | 'info' | 'warn' | 'error';
export type ContextoLog = Record<string, unknown>;

const CHAVE_SECRETA = /(token|secret|segredo|senha|password|authorization|cookie|signature|assinatura|api[_-]?key|bearer)/i;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const CPF = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;
const TELEFONE = /(?:\+?55\s?)?\(?\d{2}\)?\s?9?\d{4}-?\d{4}\b/g;
const MAX_TEXTO = 500;

export function limparTexto(valor: string): string {
  const limpo = valor.replace(EMAIL, '[email]').replace(CPF, '[cpf]').replace(TELEFONE, '[telefone]');
  return limpo.length > MAX_TEXTO ? `${limpo.slice(0, MAX_TEXTO)}…(${limpo.length})` : limpo;
}

function limparValor(chave: string, valor: unknown): unknown {
  if (CHAVE_SECRETA.test(chave)) return '[redigido]';
  if (typeof valor === 'string') return limparTexto(valor);
  return valor;
}

export function limparContexto(ctx: ContextoLog): ContextoLog {
  const saida: ContextoLog = {};
  for (const [k, v] of Object.entries(ctx)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const aninhado: ContextoLog = {};
      for (const [k2, v2] of Object.entries(v as ContextoLog)) aninhado[k2] = limparValor(k2, v2);
      saida[k] = CHAVE_SECRETA.test(k) ? '[redigido]' : aninhado;
    } else {
      saida[k] = limparValor(k, v);
    }
  }
  return saida;
}

export function infoDoErro(err: unknown): { nome: string; mensagem: string } {
  if (err instanceof Error) return { nome: err.name, mensagem: limparTexto(err.message) };
  return { nome: 'desconhecido', mensagem: limparTexto(String(err)) };
}

function emitir(nivel: NivelLog, escopo: string, mensagem: string, ctx: ContextoLog = {}): void {
  const linha = JSON.stringify({ nivel, escopo, mensagem: limparTexto(mensagem), em: new Date().toISOString(), ...limparContexto(ctx) });
  if (nivel === 'error' || nivel === 'warn') console.error(linha);
  else console.log(linha);
}

export const log = {
  debug: (escopo: string, msg: string, ctx?: ContextoLog) => emitir('debug', escopo, msg, ctx),
  info: (escopo: string, msg: string, ctx?: ContextoLog) => emitir('info', escopo, msg, ctx),
  warn: (escopo: string, msg: string, ctx?: ContextoLog) => emitir('warn', escopo, msg, ctx),
  error: (escopo: string, msg: string, ctx?: ContextoLog) => emitir('error', escopo, msg, ctx),
};
