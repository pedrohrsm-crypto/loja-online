// Cria o pedido no servidor (#27): confere a entrada, deriva o frete do CEP, monta o pedido com as
// regras de lib/pedidos/regras.ts e chama a função de banco `criar_pedido`, que reserva o estoque
// sob trava. Recebe as portas (sessão, frete, banco) por parâmetro: a Server Action
// (app/checkout/acoes.ts) liga as reais, e os testes ligam falsas.
//
// Nada de dado pessoal no log: nem CEP, nem telefone, nem endereço, nem nome. Erro de banco vai
// para o log com o código; para a tela vai só o motivo. Sem a migration (schema antigo), a
// função não existe e o resultado é 'indisponivel', nunca 500.
import type { LeituraFrete } from '@/lib/catalogo/tipos';
import { log } from '@/lib/observabilidade/logger';
import { UUID, conferirEntrada, montarPedido, type CampoPedido } from './regras';

export type ItemMarcado =
  | { variacaoId: string; tipo: 'indisponivel' }
  | { variacaoId: string; tipo: 'preco-mudou'; precoCentavos: number }
  | { variacaoId: string; tipo: 'esgotou'; disponivel: number };

export type ResultadoCriarPedido =
  | { ok: true; pedidoId: string; expiraEm: string; totalCentavos: number; reaproveitado: boolean; substituido: string | null }
  | { ok: false; motivo: 'sem-sessao' }
  | { ok: false; motivo: 'invalido'; erros: Partial<Record<CampoPedido, string>> }
  | { ok: false; motivo: 'mudou'; itens: ItemMarcado[] }
  | { ok: false; motivo: 'frete'; frete: 'cep-invalido' | 'sem-frete' | 'modo-fora-da-faixa' }
  | { ok: false; motivo: 'indisponivel' };

// Os argumentos nomeados da função de banco (migration 20261103000001).
export type ArgumentosCriarPedido = {
  p_usuario_id: string;
  p_itens: { variacao_id: string; quantidade: number; preco_centavos: number }[];
  p_cep: string;
  p_modo_entrega: string;
  p_frete_centavos: number;
  p_frete_regiao: string;
  p_frete_prazo: string;
  p_subtotal_centavos: number;
  p_total_centavos: number;
  p_telefone: string;
  p_nome_recebedor: string | null;
  p_endereco: string | null;
};

type ErroBanco = { code?: string; message: string; hint?: string | null };

export type PortasCriarPedido = {
  // O id do comprador vem da sessão validada no servidor (auth.getUser), nunca do formulário.
  usuarioId: () => Promise<string | null>;
  lerFrete: (cep: string) => Promise<LeituraFrete>;
  criarNoBanco: (args: ArgumentosCriarPedido) => Promise<{ data: unknown; error: ErroBanco | null }>;
};

function inteiro(v: unknown): v is number {
  return typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
}

// A resposta do banco também é conferida: formato inesperado é falha, nunca "pedido criado".
function lerResposta(data: unknown): ResultadoCriarPedido | null {
  if (typeof data !== 'object' || data === null) return null;
  const r = data as Record<string, unknown>;
  if (r.ok === true) {
    if (typeof r.pedido_id !== 'string' || !UUID.test(r.pedido_id) || typeof r.expira_em !== 'string' || !inteiro(r.total_centavos)) return null;
    const substituido = typeof r.substituido === 'string' && UUID.test(r.substituido) ? r.substituido : null;
    return { ok: true, pedidoId: r.pedido_id, expiraEm: r.expira_em, totalCentavos: r.total_centavos, reaproveitado: r.reaproveitado === true, substituido };
  }
  if (r.ok === false && r.motivo === 'mudou' && Array.isArray(r.itens)) {
    const itens: ItemMarcado[] = [];
    for (const x of r.itens as unknown[]) {
      if (typeof x !== 'object' || x === null) return null;
      const i = x as Record<string, unknown>;
      if (typeof i.variacao_id !== 'string') return null;
      if (i.tipo === 'indisponivel') itens.push({ variacaoId: i.variacao_id, tipo: 'indisponivel' });
      else if (i.tipo === 'preco-mudou' && inteiro(i.preco_centavos)) itens.push({ variacaoId: i.variacao_id, tipo: 'preco-mudou', precoCentavos: i.preco_centavos });
      else if (i.tipo === 'esgotou' && inteiro(i.disponivel)) itens.push({ variacaoId: i.variacao_id, tipo: 'esgotou', disponivel: i.disponivel });
      else return null;
    }
    return itens.length > 0 ? { ok: false, motivo: 'mudou', itens } : null;
  }
  return null;
}

export async function criarPedido(bruto: unknown, portas: PortasCriarPedido): Promise<ResultadoCriarPedido> {
  // 1. Quem compra: a sessão do servidor. Sem sessão, nada é conferido nem gravado.
  let usuarioId: string | null;
  try {
    usuarioId = await portas.usuarioId();
  } catch (e) {
    log.error('pedidos.criar', 'falha ao ler a sessão', { erro: e instanceof Error ? e.message : String(e) });
    return { ok: false, motivo: 'indisponivel' };
  }
  if (!usuarioId) return { ok: false, motivo: 'sem-sessao' };

  // 2. A entrada, sem confiar em nada dela (T17b): campos fora da lista são ignorados (T17d).
  const conferida = conferirEntrada(bruto);
  if (!conferida.ok) return { ok: false, motivo: 'invalido', erros: conferida.erros };
  const { entrada } = conferida;

  // 3. O frete sai do CEP gravado no pedido, lido agora no servidor (regra 3).
  const frete = await portas.lerFrete(entrada.cep);
  if (!frete.ok) {
    if (frete.motivo === 'indisponivel') return { ok: false, motivo: 'indisponivel' };
    return { ok: false, motivo: 'frete', frete: frete.motivo };
  }
  const montado = montarPedido(entrada, frete.opcoes);
  if (!montado.ok) {
    if (montado.motivo === 'modo-fora-da-faixa') return { ok: false, motivo: 'frete', frete: 'modo-fora-da-faixa' };
    return { ok: false, motivo: 'invalido', erros: { itens: 'O total do pedido ficou inválido. Volte ao carrinho e confira os itens.' } };
  }
  const p = montado.pedido;

  // 4. O banco confere o catálogo de hoje sob trava e reserva (ou devolve o que mudou).
  let resposta: { data: unknown; error: ErroBanco | null };
  try {
    resposta = await portas.criarNoBanco({
      p_usuario_id: usuarioId,
      p_itens: p.itens.map((i) => ({ variacao_id: i.variacaoId, quantidade: i.quantidade, preco_centavos: i.precoCentavos })),
      p_cep: p.cep,
      p_modo_entrega: p.modo,
      p_frete_centavos: p.frete.valorCentavos,
      p_frete_regiao: p.frete.nome,
      p_frete_prazo: p.frete.prazoTexto,
      p_subtotal_centavos: p.subtotalCentavos,
      p_total_centavos: p.totalCentavos,
      p_telefone: p.telefone,
      p_nome_recebedor: p.nome,
      p_endereco: p.endereco,
    });
  } catch (e) {
    log.error('pedidos.criar', 'chamada ao banco falhou', { erro: e instanceof Error ? e.message : String(e) });
    return { ok: false, motivo: 'indisponivel' };
  }
  if (resposta.error) {
    // PGRST202 / 42883: a função ainda não existe (migration não aplicada). Mesmo tratamento.
    // Só o código: a mensagem e a dica do Postgres podem trazer valores da linha (dado pessoal).
    log.error('pedidos.criar', 'criar_pedido falhou', { codigo: resposta.error.code });
    return { ok: false, motivo: 'indisponivel' };
  }
  const lido = lerResposta(resposta.data);
  if (!lido) {
    log.error('pedidos.criar', 'resposta inesperada de criar_pedido', {});
    return { ok: false, motivo: 'indisponivel' };
  }
  if (lido.ok) {
    log.info('pedidos.criar', lido.reaproveitado ? 'pedido aberto reaproveitado' : 'pedido criado', {
      pedido: lido.pedidoId, itens: p.itens.length, total: lido.totalCentavos, substituido: lido.substituido,
    });
  }
  return lido;
}
