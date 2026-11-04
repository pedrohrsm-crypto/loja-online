// Papéis do produto e a casa de cada um. É a configuração que muda por trabalho:
// a descoberta (docs/freelance/DESCOBERTA.md §2) define a lista; o resto do código lê daqui.
export const PAPEIS = ['cliente', 'admin'] as const;
export type Papel = (typeof PAPEIS)[number];

// A casa da dona é a fila de pedidos (tela 12; FIDELIDADE.md §1, tela 9: "admin → 12").
export const CASA_DO_PAPEL: Record<Papel, string> = {
  cliente: '/conta',
  admin: '/admin/pedidos',
};

/**
 * Áreas que exigem o segundo fator (TOTP, `aal2`) além do papel: o painel estorna dinheiro
 * (FIDELIDADE.md §1, regra 1; S-03). A área do comprador não entra aqui.
 */
export const AREAS_COM_SEGUNDO_FATOR: readonly Papel[] = ['admin'];

/** Telas do segundo fator. Moram fora de /admin: a guarda do painel nunca manda para dentro dele (04, 2.1). */
export const TELA_SEGUNDO_FATOR = '/entrar/autenticador';

/** Rotas que exigem sessão. O proxy só redireciona de forma otimista; a decisão final é do layout. */
export const PREFIXOS_PROTEGIDOS = ['/conta', '/admin'];

export function ehPapel(valor: unknown): valor is Papel {
  return typeof valor === 'string' && (PAPEIS as readonly string[]).includes(valor);
}
