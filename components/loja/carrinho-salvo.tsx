'use client';

import { useCarrinho } from '@/lib/loja/carrinho-armazenamento';

// Só diz que os itens continuam salvos quando há item: quem não tem carrinho não precisa ouvir isso.
export function CarrinhoSalvo() {
  const carrinho = useCarrinho();
  if (!carrinho || carrinho.itens.length === 0) return null;
  return <>Os itens do seu carrinho continuam salvos neste aparelho.</>;
}
