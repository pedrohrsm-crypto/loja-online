// Guarda de área: deixar entrar, mandar para a casa certa ou explicar.
//
// Duas regras que nenhum layout reimplementa (04, erros 2.1 e 2.2):
//   1. NUNCA redirecionar para a área de onde a pessoa está sendo expulsa (laço infinito).
//   2. NUNCA redirecionar quando o perfil não pôde ser LIDO. Erro de banco não é "sem
//      permissão"; tratar os dois igual transformou uma coluna faltando num laço que
//      derrubou um produto inteiro. Na dúvida, explique; não redirecione.
// E uma terceira, do painel (FIDELIDADE.md §1, regra 1; S-03): a área com segundo fator só abre
// com `aal2`. Sem ele, a dona vai para o desafio do TOTP (fora da área), nunca para /conta. Se o
// nível não pôde ser lido, vale a regra 2: explica.
// Pura e testável: recebe o que o layout já buscou.
import { comVolta } from './destino';
import { AREAS_COM_SEGUNDO_FATOR, CASA_DO_PAPEL, TELA_SEGUNDO_FATOR, ehPapel, type Papel } from './papeis';

export type Resultado =
  | { tipo: 'ok' }
  | { tipo: 'redirecionar'; destino: string }
  | { tipo: 'sem-acesso'; causa: 'erro-ao-ler-perfil' | 'sem-papel' };

/** Nível de garantia da sessão (`aal` do JWT), lido no servidor. */
export type SegundoFator = { nivel: string | null; erroAoLer?: boolean };

export function exigeSegundoFator(area: Papel): boolean {
  return AREAS_COM_SEGUNDO_FATOR.includes(area);
}

export function guardaArea(p: {
  perfil: { papel?: string | null } | null | undefined;
  erroAoLer?: boolean;
  area: Papel;
  segundoFator?: SegundoFator;
  /** Rota pedida, para voltar a ela depois do desafio. */
  caminho?: string | null;
}): Resultado {
  if (p.erroAoLer || !p.perfil) return { tipo: 'sem-acesso', causa: 'erro-ao-ler-perfil' };
  const papel = p.perfil.papel;
  if (!ehPapel(papel)) return { tipo: 'sem-acesso', causa: 'sem-papel' };
  if (papel === p.area || papel === 'admin') {
    if (!exigeSegundoFator(p.area)) return { tipo: 'ok' };
    if (!p.segundoFator || p.segundoFator.erroAoLer) return { tipo: 'sem-acesso', causa: 'erro-ao-ler-perfil' };
    if (p.segundoFator.nivel === 'aal2') return { tipo: 'ok' };
    return { tipo: 'redirecionar', destino: comVolta(TELA_SEGUNDO_FATOR, p.caminho) };
  }
  const destino = CASA_DO_PAPEL[papel];
  if (!destino || destino === CASA_DO_PAPEL[p.area]) return { tipo: 'sem-acesso', causa: 'sem-papel' };
  return { tipo: 'redirecionar', destino };
}
