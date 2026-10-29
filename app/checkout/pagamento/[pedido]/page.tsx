import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PixVista } from '@/components/loja/pix-vista';
import { lerPedidoPixExemplo } from '@/lib/loja/exemplos';

export const metadata: Metadata = { title: 'Pagamento', robots: { index: false } };

// DADOS DE EXEMPLO (lib/loja/exemplos.ts): ainda não há pedido, carrinho no servidor nem Mercado Pago.
// Com o pedido real (Dias 2 e 3), esta página passa a exigir sessão e só abre o pedido ABERTO do
// próprio comprador (FIDELIDADE.md, mapa de acesso, tela 7); pedido de outra pessoa responde 404.
export default async function PaginaPagamento({ params }: PageProps<'/checkout/pagamento/[pedido]'>) {
  const { pedido } = await params;
  const exemplo = lerPedidoPixExemplo(pedido);
  if (!exemplo) notFound();
  return <PixVista pedido={exemplo} />;
}
