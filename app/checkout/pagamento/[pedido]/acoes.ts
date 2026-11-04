'use server';

// Server Action que gera o Pix do pedido (L3). Toda Server Action é uma entrada pública por POST: a
// sessão é conferida AQUI, e a guarda (dono + pedido aberto + no prazo) mora em gerarPix
// (lib/pagamentos/cobranca.ts), que lê o pedido de novo no servidor. O id do pedido é a única entrada.
import { lerConfigMP } from '@/lib/pagamentos/config';
import { gerarPix, type ResultadoGerarPix } from '@/lib/pagamentos/cobranca';
import { portasCobranca } from '@/lib/pagamentos/repositorios';
import { log } from '@/lib/observabilidade/logger';
import { UUID } from '@/lib/pedidos/regras';
import { clienteAdmin } from '@/lib/supabase/admin';
import { clienteServidor } from '@/lib/supabase/servidor';

export async function gerarPixDoPedido(pedidoId: unknown): Promise<ResultadoGerarPix> {
  if (typeof pedidoId !== 'string' || !UUID.test(pedidoId)) return { ok: false, motivo: 'nao-encontrado' };
  const supabase = await clienteServidor();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { ok: false, motivo: 'nao-encontrado' };
  const config = lerConfigMP();
  if (!config.ok) {
    log.error('pagamentos.pix', 'configuração do Mercado Pago incompleta', { faltando: config.faltando });
    return { ok: false, motivo: 'indisponivel' };
  }
  return gerarPix(
    { pedidoId, usuarioId: data.user.id, email: data.user.email ?? null, config: config.config },
    portasCobranca(clienteAdmin(), config.config),
  );
}
