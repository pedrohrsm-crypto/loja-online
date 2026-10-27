// A coluna pedida não existe neste banco: a migration que a cria ainda não foi aplicada.
// `42703` vem do Postgres (undefined_column); `PGRST204`, do PostgREST quando o cache de
// schema não conhece a coluna. Regra: migration antes do deploy, e o código tolera o
// schema antigo (04, erro 1.1). Este é o único lugar desses dois literais.
const COLUNA_INEXISTENTE = '42703';
const COLUNA_FORA_DO_CACHE = 'PGRST204';

export function ehColunaAusente(codigo: string | null | undefined): boolean {
  return codigo === COLUNA_INEXISTENTE || codigo === COLUNA_FORA_DO_CACHE;
}
