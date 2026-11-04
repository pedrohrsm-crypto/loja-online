import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PixVista } from '@/components/loja/pix-vista';
import { SemAcesso } from '@/components/sem-acesso';
import { log } from '@/lib/observabilidade/logger';
import { consultarPix } from '@/lib/pagamentos/cobranca';
import { lerConfigMP } from '@/lib/pagamentos/config';
import { portasCobranca } from '@/lib/pagamentos/repositorios';
import { montarTelaAgora, type LinhaTela } from '@/lib/pagamentos/tela';
import { UUID } from '@/lib/pedidos/regras';
import { entrarNaArea } from '@/lib/seguranca/area';
import { clienteAdmin } from '@/lib/supabase/admin';
import { ehColunaAusente } from '@/lib/supabase/coluna-ausente';
import { clienteServidor } from '@/lib/supabase/servidor';

export const metadata: Metadata = { title: 'Pagamento', robots: { index: false } };

const COLUNAS = 'id, status, total_centavos, expira_em, cancelado_em, mp_qr_code, mp_qr_code_base64, itens_pedido(variacao_id, quantidade)';

// Tela 7 (Pagamento Pix, #32). Só o comprador com sessão, e só o PRÓPRIO pedido: a leitura é com o
// cliente dele, e a RLS dá só as linhas dele; pedido de outra pessoa responde 404, igual a inexistente
// (FIDELIDADE §1, mapa de acesso e regra 5). Pedido fechado não mostra QR. Com o pedido aberto e o Pix
// gerado, a página consulta o Mercado Pago (o webhook pode atrasar) antes de mostrar.
export default async function PaginaPagamento({ params }: PageProps<'/checkout/pagamento/[pedido]'>) {
  const { pedido } = await params;
  const { resultado, usuarioId } = await entrarNaArea('cliente');
  if (resultado.tipo === 'sem-acesso') return <SemAcesso causa={resultado.causa} />;
  if (!UUID.test(pedido)) notFound();

  const supabase = await clienteServidor();
  const ler = async () => supabase.from('pedidos').select(COLUNAS).eq('id', pedido).eq('usuario_id', usuarioId).is('produto', null).maybeSingle();
  let { data, error } = await ler();
  if (error) {
    log.error('pagamentos.tela', 'pedido não lido', { codigo: error.code, schemaAntigo: ehColunaAusente(error.code) });
    return <PixVista tela={null} />;
  }
  if (!data) notFound();

  const config = lerConfigMP();
  if ((data as LinhaTela).status === 'aberto' && config.ok) {
    const portas = portasCobranca(clienteAdmin(), config.config);
    const interno = await portas.lerPedido(pedido).catch((e: unknown) => {
      log.warn('pagamentos.tela', 'pedido interno não lido', { erro: e instanceof Error ? e.message : String(e) });
      return null;
    });
    if (interno?.mpOrderId && interno.usuarioId === usuarioId) {
      await consultarPix(interno, config.config, portas);
      // Relê: a consulta pode ter confirmado o pagamento ou completado o QR.
      ({ data, error } = await ler());
    }
  }
  const tela = data && !error ? montarTelaAgora(data as LinhaTela) : null;
  if (!tela) return <PixVista tela={null} />;
  return <PixVista tela={tela} />;
}
