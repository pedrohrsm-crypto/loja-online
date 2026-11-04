import type { Metadata } from 'next';
import { clienteServidor } from '@/lib/supabase/servidor';
import { entrarNaArea } from '@/lib/seguranca/area';
import { SemAcesso } from '@/components/sem-acesso';
import { PRODUTOS, formatarReais } from '@/lib/pagamentos/produtos';
import { formatarPreco } from '@/lib/catalogo/preco';
import { lerPedidosResumidos, rotuloDoPedido } from '@/lib/pedidos/resumo';
import { FormularioCompra, FormularioExclusao, FormularioNome } from './formularios';
import { sair } from './acoes';

export const metadata: Metadata = { title: 'Minha conta' };

const ROTULO_STATUS: Record<string, string> = { aberto: 'Aguardando pagamento', pago: 'Pago', estornado: 'Estornado', cancelado: 'Cancelado' };

export default async function Conta({ searchParams }: PageProps<'/conta'>) {
  const { pagamento } = await searchParams;
  const { resultado, usuarioId, email } = await entrarNaArea('cliente');
  if (resultado.tipo === 'sem-acesso') return <SemAcesso causa={resultado.causa} />;
  const supabase = await clienteServidor();
  const [perfil, pedidos] = await Promise.all([
    supabase.from('perfis').select('nome').eq('id', usuarioId).maybeSingle(),
    lerPedidosResumidos(supabase, 20),
  ]);
  const produto = PRODUTOS.curso;
  const jaPagou = pedidos.ok && pedidos.dados.some((p) => p.descricao.tipo === 'produto' && p.descricao.produto === produto.slug && p.status === 'pago');

  return (
    <div className="space-y-10">
      <h1 className="text-3xl font-bold">Minha conta</h1>

      {pagamento === 'retorno' ? (
        // O estado vem do BANCO, não da URL: a volta do pagamento chega antes do webhook às vezes.
        <p role="status" className="rounded-md border border-borda bg-superficie p-3">
          {jaPagou ? 'Pagamento confirmado. Obrigado!' : 'Recebemos o seu pagamento e estamos confirmando. Isso leva alguns instantes; recarregue a página.'}
        </p>
      ) : null}

      <section aria-labelledby="t-compras" className="space-y-3">
        <h2 id="t-compras" className="text-xl font-semibold">Compras</h2>
        {!pedidos.ok ? <p role="alert" className="text-erro">Não foi possível carregar as suas compras agora.</p> : null}
        {pedidos.ok && pedidos.dados.length > 0 ? (
          <ul className="space-y-1">
            {pedidos.dados.map((p) => (
              <li key={p.id}>{rotuloDoPedido(p, (slug) => PRODUTOS[slug]?.nome ?? slug)} · {p.valorCentavos === null ? '—' : formatarPreco(p.valorCentavos)} · {ROTULO_STATUS[p.status] ?? p.status}</li>
            ))}
          </ul>
        ) : pedidos.ok ? <p>Nenhuma compra ainda.</p> : null}
        {!jaPagou ? <FormularioCompra produto={produto.slug} rotulo={`Comprar ${produto.nome} por ${formatarReais(produto.valorCentavos)}`} /> : null}
      </section>

      <section aria-labelledby="t-dados" className="space-y-3">
        <h2 id="t-dados" className="text-xl font-semibold">Seus dados</h2>
        <p>E-mail: {email}</p>
        <FormularioNome nome={perfil.data?.nome ?? ''} />
      </section>

      <section aria-labelledby="t-sair" className="space-y-3">
        <h2 id="t-sair" className="text-xl font-semibold">Sessão e exclusão</h2>
        <form action={sair}><button type="submit" className="underline">Sair</button></form>
        <FormularioExclusao />
      </section>
    </div>
  );
}
