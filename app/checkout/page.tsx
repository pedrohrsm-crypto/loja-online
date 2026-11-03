import type { Metadata } from 'next';
import { SemAcesso } from '@/components/sem-acesso';
import { entrarNaArea } from '@/lib/seguranca/area';
import { CheckoutVista } from './checkout-vista';

export const metadata: Metadata = { title: 'Entrega', robots: { index: false } };

// Tela 6 (Entrega). Só o comprador com sessão cria pedido (mapa de acesso); sem sessão vai para
// /entrar. A Server Action confere a sessão de novo: a página não é a barreira (04, 2.9).
export default async function PaginaCheckout() {
  const { resultado } = await entrarNaArea('cliente');
  if (resultado.tipo === 'sem-acesso') return <SemAcesso causa={resultado.causa} />;
  return <CheckoutVista />;
}
