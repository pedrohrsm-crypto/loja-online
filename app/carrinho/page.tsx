import type { Metadata } from 'next';
import { CarrinhoVista } from '@/components/loja/carrinho-vista';

export const metadata: Metadata = { title: 'Carrinho' };

// O carrinho mora no navegador do comprador (localStorage); o servidor só entrega a casca.
export default function PaginaCarrinho() {
  return <CarrinhoVista />;
}
