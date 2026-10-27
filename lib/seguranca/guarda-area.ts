// Guarda de área: deixar entrar, mandar para a casa certa ou explicar.
//
// Duas regras que nenhum layout reimplementa (04, erros 2.1 e 2.2):
//   1. NUNCA redirecionar para a área de onde a pessoa está sendo expulsa (laço infinito).
//   2. NUNCA redirecionar quando o perfil não pôde ser LIDO. Erro de banco não é "sem
//      permissão"; tratar os dois igual transformou uma coluna faltando num laço que
//      derrubou um produto inteiro. Na dúvida, explique; não redirecione.
// Pura e testável: recebe o que o layout já buscou.
import { CASA_DO_PAPEL, ehPapel, type Papel } from './papeis';

export type Resultado =
  | { tipo: 'ok' }
  | { tipo: 'redirecionar'; destino: string }
  | { tipo: 'sem-acesso'; causa: 'erro-ao-ler-perfil' | 'sem-papel' };

export function guardaArea(p: { perfil: { papel?: string | null } | null | undefined; erroAoLer?: boolean; area: Papel }): Resultado {
  if (p.erroAoLer || !p.perfil) return { tipo: 'sem-acesso', causa: 'erro-ao-ler-perfil' };
  const papel = p.perfil.papel;
  if (!ehPapel(papel)) return { tipo: 'sem-acesso', causa: 'sem-papel' };
  if (papel === p.area || papel === 'admin') return { tipo: 'ok' };
  const destino = CASA_DO_PAPEL[papel];
  if (!destino || destino === CASA_DO_PAPEL[p.area]) return { tipo: 'sem-acesso', causa: 'sem-papel' };
  return { tipo: 'redirecionar', destino };
}
