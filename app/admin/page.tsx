import type { Metadata } from 'next';
import { clienteAdmin } from '@/lib/supabase/admin';
import { formatarPreco } from '@/lib/catalogo/preco';
import { lerPedidosResumidos, rotuloDoPedido } from '@/lib/pedidos/resumo';
import { entrarNaArea } from '@/lib/seguranca/area';
import { SemAcesso } from '@/components/sem-acesso';

export const metadata: Metadata = { title: 'Painel' };

// A leitura usa a service_role porque a RLS de pedidos só mostra os próprios; por isso a guarda
// roda AQUI, antes da leitura, e não só no layout (04, 2.9).
export default async function Painel() {
  const { resultado } = await entrarNaArea('admin');
  if (resultado.tipo === 'sem-acesso') return <SemAcesso causa={resultado.causa} />;
  const pedidos = await lerPedidosResumidos(clienteAdmin(), 50);
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Painel</h1>
      {!pedidos.ok ? <p role="alert" className="text-erro">Não foi possível carregar os pedidos.</p> : null}
      <table className="w-full text-left">
        <caption className="text-left text-texto-suave">Últimos 50 pedidos</caption>
        <thead><tr><th scope="col">Data</th><th scope="col">Produto</th><th scope="col">Valor</th><th scope="col">Status</th></tr></thead>
        <tbody>
          {(pedidos.ok ? pedidos.dados : []).map((p) => (
            <tr key={p.id} className="border-t border-borda">
              <td>{new Date(p.criadoEm).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</td>
              <td>{rotuloDoPedido(p)}</td>
              <td>{p.valorCentavos === null ? '—' : formatarPreco(p.valorCentavos)}</td>
              <td>{p.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
