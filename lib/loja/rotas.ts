// Navegação da loja e do painel (FIDELIDADE.md §1): até 5 destinos na loja, 3 no admin.
// Só entram destinos que já existem: Categorias e Busca (outra frente) e Produtos e Fretes do
// painel (Dia 2 em diante) ficam fora ou desligados até a rota existir, para não haver link quebrado.
export type Destino = { href: string; rotulo: string; existe: boolean };

export const DESTINOS_LOJA: readonly Destino[] = [
  { href: '/', rotulo: 'Início', existe: true },
  { href: '/carrinho', rotulo: 'Carrinho', existe: true },
  { href: '/conta', rotulo: 'Conta', existe: true },
];

export const DESTINOS_ADMIN: readonly Destino[] = [
  { href: '/admin/pedidos', rotulo: 'Pedidos', existe: true },
  { href: '/admin/produtos', rotulo: 'Produtos', existe: false },
  { href: '/admin/fretes', rotulo: 'Fretes', existe: false },
];

export function ehRotaAdmin(caminho: string | null): boolean {
  return caminho === '/admin' || (caminho?.startsWith('/admin/') ?? false);
}

export function destinoAtivo(caminho: string | null, href: string): boolean {
  if (!caminho) return false;
  return href === '/' ? caminho === '/' : caminho === href || caminho.startsWith(`${href}/`);
}
