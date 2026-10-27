// Papéis do produto e a casa de cada um. É a configuração que muda por trabalho:
// a descoberta (docs/freelance/DESCOBERTA.md §2) define a lista; o resto do código lê daqui.
export const PAPEIS = ['cliente', 'admin'] as const;
export type Papel = (typeof PAPEIS)[number];

export const CASA_DO_PAPEL: Record<Papel, string> = {
  cliente: '/conta',
  admin: '/admin',
};

/** Rotas que exigem sessão. O proxy só redireciona de forma otimista; a decisão final é do layout. */
export const PREFIXOS_PROTEGIDOS = ['/conta', '/admin'];

export function ehPapel(valor: unknown): valor is Papel {
  return typeof valor === 'string' && (PAPEIS as readonly string[]).includes(valor);
}
