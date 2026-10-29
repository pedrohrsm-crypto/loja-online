// Regras do painel de pedidos (L5). A dona só faz a logística: pago → separado → enviado → entregue
// (FIDELIDADE.md §1, regra 2). Cancelado, estornado e contestado só o servidor grava, a partir do
// Mercado Pago; aqui existem só para exibir. Nesta frente tudo é visual (dados de exemplo).
export type StatusPedido = 'pago' | 'separado' | 'enviado' | 'entregue' | 'estornado';
export type ModoEntrega = 'correios' | 'motoboy' | 'retirada';

export type PedidoPainel = {
  numero: string;
  cliente: string; // nome abreviado, como a dona lê na lista
  totalCentavos: number;
  modo: ModoEntrega;
  status: StatusPedido;
  pagoHaMinutos: number;
  itens: string[];
};

export const ROTULO_STATUS: Record<StatusPedido, string> = {
  pago: 'Pago',
  separado: 'Em preparação',
  enviado: 'Enviado',
  entregue: 'Entregue',
  estornado: 'Estornado',
};

const PROXIMO: Partial<Record<StatusPedido, StatusPedido>> = { pago: 'separado', separado: 'enviado', enviado: 'entregue' };

export const ROTULO_ACAO: Partial<Record<StatusPedido, string>> = {
  pago: 'Marcar como separado',
  separado: 'Marcar como enviado',
  enviado: 'Marcar como entregue',
};

export function proximoStatus(atual: StatusPedido): StatusPedido | null {
  return PROXIMO[atual] ?? null;
}

// Retirada e motoboy não têm rastreio: separado → entregue vale como "enviado" para quem busca.
// Só os Correios exigem o código antes de "enviado".
export function exigeRastreio(pedido: Pick<PedidoPainel, 'modo' | 'status'>): boolean {
  return pedido.modo === 'correios' && pedido.status === 'separado';
}

const ORDEM: Record<StatusPedido, number> = { pago: 0, separado: 1, enviado: 2, entregue: 3, estornado: 4 };

// Pagos primeiro; dentro do mesmo status, o pago há mais tempo no topo (espera mais).
export function ordenarPedidos(pedidos: readonly PedidoPainel[]): PedidoPainel[] {
  return [...pedidos].sort((a, b) => ORDEM[a.status] - ORDEM[b.status] || b.pagoHaMinutos - a.pagoHaMinutos || a.numero.localeCompare(b.numero));
}

export type FiltroPedidos = StatusPedido | 'todos';

export function filtrarPedidos(pedidos: readonly PedidoPainel[], filtro: FiltroPedidos): PedidoPainel[] {
  return ordenarPedidos(filtro === 'todos' ? pedidos : pedidos.filter((p) => p.status === filtro));
}

export function contarPorStatus(pedidos: readonly PedidoPainel[], status: StatusPedido): number {
  return pedidos.filter((p) => p.status === status).length;
}

// Código de rastreio dos Correios: 2 letras, 9 números e BR.
const RASTREIO = /^[A-Z]{2}\d{9}BR$/;

export function normalizarRastreio(entrada: string): string {
  return entrada.replace(/\s+/g, '').toUpperCase();
}

export function validarRastreio(entrada: string): { ok: true; codigo: string } | { ok: false; erro: string } {
  const codigo = normalizarRastreio(entrada);
  if (RASTREIO.test(codigo)) return { ok: true, codigo };
  return { ok: false, erro: 'O código tem 2 letras, 9 números e BR. Exemplo: AA123456789BR.' };
}

export function textoHa(minutos: number): string {
  if (minutos < 60) return `pago há ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `pago há ${horas} h`;
  const dias = Math.floor(horas / 24);
  return `pago há ${dias} ${dias === 1 ? 'dia' : 'dias'}`;
}
