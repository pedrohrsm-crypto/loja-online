// O que a tela do Pix (tela 7) mostra, a partir do pedido lido no servidor (L3). Pura. A tela consulta
// o estado REAL do pedido (banco, atualizado pelo webhook, pela reconciliação e pela própria consulta
// da tela ao Mercado Pago), nunca a URL nem um parâmetro de volta.
import type { SituacaoPix } from '@/lib/loja/pix';
import { segundosRestantes } from '@/lib/loja/pix';

export type LinhaTela = {
  id: string;
  status: string;
  total_centavos: number | null;
  expira_em: string | null;
  cancelado_em: string | null;
  mp_qr_code: string | null;
  mp_qr_code_base64: string | null;
  itens_pedido: { variacao_id: string; quantidade: number }[] | null;
};

export type TelaPix = {
  pedidoId: string;
  numero: string;
  totalCentavos: number;
  // 'gerando': pedido aberto ainda sem o Pix (a tela pede ao servidor e atualiza).
  situacao: SituacaoPix | 'gerando';
  segundosRestantes: number;
  qrCode: string | null;
  qrCodeBase64: string | null;
  itens: { variacaoId: string; quantidade: number }[];
};

/** O número que o comprador vê (o mesmo da tela "Pedido reservado"). */
export function numeroDoPedido(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

export function montarTela(l: LinhaTela, agoraMs: number): TelaPix | null {
  if (l.total_centavos === null || l.expira_em === null) return null;
  const expira = new Date(l.expira_em).getTime();
  let situacao: TelaPix['situacao'];
  if (l.status === 'pago') situacao = 'pago';
  else if (l.status === 'aberto') situacao = l.mp_qr_code ? 'aguardando' : 'gerando';
  // Cancelado pelo prazo (a expiração acontece depois de expira_em): "O Pix expirou", com o "Já pagou?".
  // Cancelado antes do prazo (o carrinho mudou e virou outro pedido, ou a conta foi excluída): "cancelado".
  else if (l.status === 'cancelado' && l.cancelado_em && new Date(l.cancelado_em).getTime() >= expira) situacao = 'expirado';
  else situacao = 'cancelado';
  return {
    pedidoId: l.id,
    numero: numeroDoPedido(l.id),
    totalCentavos: l.total_centavos,
    situacao,
    segundosRestantes: situacao === 'aguardando' || situacao === 'gerando' ? segundosRestantes(expira, agoraMs) : 0,
    qrCode: l.status === 'aberto' ? l.mp_qr_code : null,
    qrCodeBase64: l.status === 'aberto' ? l.mp_qr_code_base64 : null,
    itens: (l.itens_pedido ?? []).map((i) => ({ variacaoId: i.variacao_id, quantidade: i.quantidade })),
  };
}

/** A tela no relógio do servidor, no momento da leitura (a página é dinâmica: lê a sessão a cada pedido). */
export function montarTelaAgora(l: LinhaTela): TelaPix | null {
  return montarTela(l, Date.now());
}
