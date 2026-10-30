import type { Metadata } from 'next';
import { SemAcesso } from '@/components/sem-acesso';
import { PedidosAdmin } from '@/components/loja/pedidos-admin';
import { PEDIDOS_PAINEL_EXEMPLO } from '@/lib/loja/exemplos';
import { entrarNaArea } from '@/lib/seguranca/area';

export const metadata: Metadata = { title: 'Pedidos', robots: { index: false } };

// A guarda roda AQUI também, não só no layout (lib/guardas.test.ts, 04 2.9). Hoje a página mostra
// DADOS DE EXEMPLO (nenhuma leitura no banco); com os pedidos reais, a leitura vem depois desta guarda.
export default async function PaginaPedidosAdmin() {
  const { resultado } = await entrarNaArea('admin');
  if (resultado.tipo === 'sem-acesso') return <SemAcesso causa={resultado.causa} />;
  return <PedidosAdmin pedidos={PEDIDOS_PAINEL_EXEMPLO} />;
}
