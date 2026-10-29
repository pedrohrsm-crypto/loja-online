// ÚNICO módulo de DADOS DE EXEMPLO da alta fidelidade (Dia 1). Tudo aqui é inventado: nomes de
// pessoas fictícias, sem CPF, sem endereço, sem telefone, e um "Pix" que não existe. Pedidos, carrinho
// no servidor e Mercado Pago ainda não existem; quando chegarem (Dias 2 e 3), este módulo sai e as
// telas passam a ler o pedido de verdade. Nenhuma chamada ao Mercado Pago acontece nesta frente.
import type { SituacaoPix } from './pix';
import type { PedidoPainel } from './pedidos';

export const AVISO_EXEMPLO = 'Pedido, QR e código de exemplo: nenhum pagamento é feito.';
export const AVISO_EXEMPLO_ADMIN = 'Nada aqui é gravado.';

// Não é um Pix real: o prefixo impede que alguém cole isto num aplicativo de banco achando que paga.
export const CODIGO_PIX_EXEMPLO = 'EXEMPLO-NAO-E-UM-PIX-0002012658EXEMPLO5204000053039865406119.00';

export type PedidoPixExemplo = {
  numero: string;
  totalCentavos: number;
  situacao: SituacaoPix;
  // Quanto falta do prazo de 30 minutos quando a página abre (só para "aguardando").
  segundosRestantes: number;
};

export const PEDIDOS_PIX_EXEMPLO: readonly PedidoPixExemplo[] = [
  { numero: '1042', totalCentavos: 11900, situacao: 'aguardando', segundosRestantes: 29 * 60 + 41 },
  { numero: '1043', totalCentavos: 6000, situacao: 'em-confirmacao', segundosRestantes: 0 },
  { numero: '1044', totalCentavos: 4500, situacao: 'expirado', segundosRestantes: 0 },
  { numero: '1046', totalCentavos: 2200, situacao: 'pago', segundosRestantes: 0 },
  { numero: '1047', totalCentavos: 3000, situacao: 'cancelado', segundosRestantes: 0 },
];

export function lerPedidoPixExemplo(numero: string): PedidoPixExemplo | null {
  return PEDIDOS_PIX_EXEMPLO.find((p) => p.numero === numero) ?? null;
}

export const PEDIDOS_PAINEL_EXEMPLO: readonly PedidoPainel[] = [
  { numero: '1042', cliente: 'Ana E.', totalCentavos: 11900, modo: 'correios', status: 'pago', pagoHaMinutos: 120, itens: ['2 × Sabonete artesanal · lavanda · 90 g', '1 × Vela aromática · alecrim · 150 g'] },
  { numero: '1043', cliente: 'Bruno E.', totalCentavos: 6000, modo: 'motoboy', status: 'pago', pagoHaMinutos: 45, itens: ['2 × Sabonete artesanal · alecrim · 140 g'] },
  { numero: '1045', cliente: 'Carla E.', totalCentavos: 4500, modo: 'retirada', status: 'pago', pagoHaMinutos: 15, itens: ['1 × Vela aromática · lavanda · 150 g'] },
  { numero: '1040', cliente: 'Diego E.', totalCentavos: 8800, modo: 'correios', status: 'separado', pagoHaMinutos: 26 * 60, itens: ['4 × Sabonete artesanal · laranja-doce · 90 g'] },
  { numero: '1038', cliente: 'Elisa E.', totalCentavos: 7400, modo: 'correios', status: 'enviado', pagoHaMinutos: 3 * 24 * 60, itens: ['1 × Kit presente · lavanda'] },
  { numero: '1035', cliente: 'Fábio E.', totalCentavos: 2200, modo: 'motoboy', status: 'entregue', pagoHaMinutos: 6 * 24 * 60, itens: ['1 × Sabonete artesanal · alecrim · 90 g'] },
];
