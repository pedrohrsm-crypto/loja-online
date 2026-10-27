// Escrita conferida: o único lugar que decide se uma escrita no banco deu certo.
//
// Duas regras inegociáveis num helper só: nunca descartar `error`, e toda escrita
// confere as linhas afetadas. Um UPDATE que a RLS barrou volta SEM erro e com 0 linhas
// (04, erro 1.7); sem conferir, a tela diz "salvo" e o dado se perde.
//
//   const r = await escrever(
//     supabase.from('perfis').update({ nome }).eq('id', id).select('id'),
//     { esperado: 1, escopo: 'conta.salvar-nome', contexto: { id } },
//   );
//   if (!r.ok) return { erro: 'Não foi possível salvar. Tente de novo.' };
//
// O detalhe do banco vai para o log aqui dentro; ao usuário vai uma frase que ele
// entende, nunca a mensagem crua do banco.
import { log, type ContextoLog } from '@/lib/observabilidade/logger';

export type Esperado = number | 'um-ou-mais';

type ErroBanco = { code?: string; message: string; hint?: string | null };
type RespostaComLinhas = { data: readonly unknown[] | null; error: ErroBanco | null };

export type ResultadoEscrita =
  | { ok: true; linhas: number; erro: null }
  | { ok: false; linhas: number; erro: ErroBanco | null };

export function linhasConferem(linhas: number, esperado: Esperado): boolean {
  return esperado === 'um-ou-mais' ? linhas >= 1 : linhas === esperado;
}

export async function escrever(
  consulta: PromiseLike<RespostaComLinhas>,
  opcoes: { esperado: Esperado; escopo: string; contexto?: ContextoLog },
): Promise<ResultadoEscrita> {
  const { data, error } = await consulta;
  const linhas = data?.length ?? 0;
  if (error) {
    log.error(opcoes.escopo, 'escrita falhou', { ...opcoes.contexto, codigo: error.code, erro: error.message, dica: error.hint });
    return { ok: false, linhas, erro: error };
  }
  if (!linhasConferem(linhas, opcoes.esperado)) {
    log.warn(opcoes.escopo, 'escrita não tocou as linhas esperadas', { ...opcoes.contexto, linhas, esperado: opcoes.esperado });
    return { ok: false, linhas, erro: null };
  }
  return { ok: true, linhas, erro: null };
}
