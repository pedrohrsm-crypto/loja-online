import type { Metadata } from 'next';
import { clienteAdmin } from '@/lib/supabase/admin';
import { formatarReais } from '@/lib/pagamentos/produtos';
import { entrarNaArea } from '@/lib/seguranca/area';
import { SemAcesso } from '@/components/sem-acesso';

export const metadata: Metadata = { title: 'Painel' };

// A leitura usa a service_role porque a RLS de pedidos só mostra os próprios; por isso a guarda
// roda AQUI, antes da leitura, e não só no layout (04, 2.9).
export default async function Painel() {
  const { resultado } = await entrarNaArea('admin');
  if (resultado.tipo === 'sem-acesso') return <SemAcesso causa={resultado.causa} />;
  const { data, error } = await clienteAdmin().from('pedidos').select('id, produto, valor_centavos, status, criado_em').order('criado_em', { ascending: false }).limit(50);
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Painel</h1>
      {error ? <p role="alert" className="text-erro">Não foi possível carregar os pedidos.</p> : null}
      <table className="w-full text-left">
        <caption className="text-left text-texto-suave">Últimos 50 pedidos</caption>
        <thead><tr><th scope="col">Data</th><th scope="col">Produto</th><th scope="col">Valor</th><th scope="col">Status</th></tr></thead>
        <tbody>
          {(data ?? []).map((p) => (
            <tr key={p.id} className="border-t border-borda">
              <td>{new Date(p.criado_em).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</td>
              <td>{p.produto}</td>
              <td>{formatarReais(p.valor_centavos)}</td>
              <td>{p.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
