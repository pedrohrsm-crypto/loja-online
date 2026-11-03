import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FreteRegiao, LeituraFrete } from '@/lib/catalogo/tipos';
import { criarPedido, type ArgumentosCriarPedido, type PortasCriarPedido } from './criar';

const COMPRADOR = '00000000-0000-4000-8000-0000000000c1';
const V1 = '11111111-1111-4111-8111-111111111111';
const PEDIDO = '99999999-9999-4999-8999-999999999999';

const SUDESTE: FreteRegiao = { nome: 'Sudeste e Sul', cepInicio: '20000000', cepFim: '39999999', modo: 'correios', valorCentavos: 3000, prazoTexto: '4 a 9 dias úteis' };
const ENTRADA = {
  itens: [{ variacaoId: V1, quantidade: 2, precoCentavos: 2200 }],
  cep: '20040-002', modo: 'correios', telefone: '(21) 90000-0000', nome: 'Ana Exemplo', endereco: 'Rua de Exemplo, 10',
};
const CRIADO = { ok: true, pedido_id: PEDIDO, expira_em: '2026-11-03T15:30:00+00:00', total_centavos: 7400, reaproveitado: false, substituido: null };

function portas(extra: Partial<PortasCriarPedido> = {}) {
  const chamadas: ArgumentosCriarPedido[] = [];
  const ceps: string[] = [];
  const p: PortasCriarPedido = {
    usuarioId: async () => COMPRADOR,
    lerFrete: async (cep): Promise<LeituraFrete> => {
      ceps.push(cep);
      return { ok: true, cep, opcoes: [SUDESTE] };
    },
    criarNoBanco: async (args) => {
      chamadas.push(args);
      return { data: CRIADO, error: null };
    },
    ...extra,
  };
  return { p, chamadas, ceps };
}

const saida = { erro: vi.spyOn(console, 'error').mockImplementation(() => {}), info: vi.spyOn(console, 'log').mockImplementation(() => {}) };
afterEach(() => {
  saida.erro.mockClear();
  saida.info.mockClear();
});

describe('criar pedido no servidor', () => {
  it('sem sessão: nada é conferido, lido nem gravado', async () => {
    const { p, chamadas, ceps } = portas({ usuarioId: async () => null });
    expect(await criarPedido(ENTRADA, p)).toEqual({ ok: false, motivo: 'sem-sessao' });
    expect(chamadas).toEqual([]);
    expect(ceps).toEqual([]);
  });

  it('o comprador vem da sessão, nunca da entrada', async () => {
    const { p, chamadas } = portas();
    await criarPedido({ ...ENTRADA, usuarioId: 'outra-pessoa', p_usuario_id: 'outra-pessoa' }, p);
    expect(chamadas[0].p_usuario_id).toBe(COMPRADOR);
  });

  it('T17d: o frete é o da faixa do CEP lido no servidor; valor e região do formulário são ignorados', async () => {
    const { p, chamadas, ceps } = portas();
    const r = await criarPedido({ ...ENTRADA, freteCentavos: 0, regiao: 'Retirada no ateliê', totalCentavos: 100 }, p);
    expect(ceps).toEqual(['20040002']);
    expect(chamadas[0]).toMatchObject({
      p_cep: '20040002', p_modo_entrega: 'correios', p_frete_centavos: 3000, p_frete_regiao: 'Sudeste e Sul',
      p_subtotal_centavos: 4400, p_total_centavos: 7400,
      p_itens: [{ variacao_id: V1, quantidade: 2, preco_centavos: 2200 }],
    });
    expect(r).toEqual({ ok: true, pedidoId: PEDIDO, expiraEm: CRIADO.expira_em, totalCentavos: 7400, reaproveitado: false, substituido: null });
  });

  it('T17b no servidor: quantidade inválida volta o campo e não chama o banco', async () => {
    const { p, chamadas } = portas();
    const r = await criarPedido({ ...ENTRADA, itens: [{ variacaoId: V1, quantidade: -1, precoCentavos: 2200 }] }, p);
    expect(r.ok === false && r.motivo).toBe('invalido');
    expect(chamadas).toEqual([]);
  });

  it('modo fora da faixa do CEP (retirada fora da cidade) não chama o banco', async () => {
    const { p, chamadas } = portas();
    expect(await criarPedido({ ...ENTRADA, modo: 'retirada' }, p)).toEqual({ ok: false, motivo: 'frete', frete: 'modo-fora-da-faixa' });
    expect(chamadas).toEqual([]);
  });

  it('T17c e A-03: item fora do ar, com preço novo ou esgotado volta marcado, sem pedido', async () => {
    const { p } = portas({
      criarNoBanco: async () => ({
        data: { ok: false, motivo: 'mudou', itens: [
          { variacao_id: V1, tipo: 'indisponivel' },
          { variacao_id: 'v2', tipo: 'preco-mudou', preco_centavos: 2400 },
          { variacao_id: 'v3', tipo: 'esgotou', disponivel: 0 },
        ] },
        error: null,
      }),
    });
    expect(await criarPedido(ENTRADA, p)).toEqual({ ok: false, motivo: 'mudou', itens: [
      { variacaoId: V1, tipo: 'indisponivel' },
      { variacaoId: 'v2', tipo: 'preco-mudou', precoCentavos: 2400 },
      { variacaoId: 'v3', tipo: 'esgotou', disponivel: 0 },
    ] });
  });

  it('schema antigo: a função ainda não existe (PGRST202) e a tela recebe "indisponível", sem exceção', async () => {
    const { p } = portas({ criarNoBanco: async () => ({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.criar_pedido' } }) });
    expect(await criarPedido(ENTRADA, p)).toEqual({ ok: false, motivo: 'indisponivel' });
    expect(saida.erro).toHaveBeenCalledTimes(1);
  });

  it('o banco lança (chave de serviço ausente, rede) ou a sessão falha: "indisponível"', async () => {
    expect(await criarPedido(ENTRADA, portas({ criarNoBanco: async () => { throw new Error('variável de ambiente ausente'); } }).p)).toEqual({ ok: false, motivo: 'indisponivel' });
    expect(await criarPedido(ENTRADA, portas({ usuarioId: async () => { throw new Error('auth fora'); } }).p)).toEqual({ ok: false, motivo: 'indisponivel' });
  });

  it('frete fora do ar é "indisponível"; CEP sem entrega diz o motivo', async () => {
    expect(await criarPedido(ENTRADA, portas({ lerFrete: async () => ({ ok: false, motivo: 'indisponivel' }) }).p)).toEqual({ ok: false, motivo: 'indisponivel' });
    expect(await criarPedido(ENTRADA, portas({ lerFrete: async () => ({ ok: false, motivo: 'sem-frete' }) }).p)).toEqual({ ok: false, motivo: 'frete', frete: 'sem-frete' });
  });

  it('resposta do banco fora do formato nunca vira "pedido criado"', async () => {
    for (const data of [null, {}, { ok: true }, { ok: true, pedido_id: 'x', expira_em: 'y', total_centavos: 1 }, { ok: false, motivo: 'mudou', itens: [] }, { ok: false, motivo: 'mudou', itens: [{ variacao_id: V1, tipo: 'outro' }] }]) {
      expect(await criarPedido(ENTRADA, portas({ criarNoBanco: async () => ({ data, error: null }) }).p), JSON.stringify(data)).toEqual({ ok: false, motivo: 'indisponivel' });
    }
  });

  it('T18: o pedido substituído volta para a F4 cancelar a cobrança dele', async () => {
    const antigo = '88888888-8888-4888-8888-888888888888';
    const { p } = portas({ criarNoBanco: async () => ({ data: { ...CRIADO, substituido: antigo }, error: null }) });
    const r = await criarPedido(ENTRADA, p);
    expect(r.ok && r.substituido).toBe(antigo);
  });

  it('nenhum dado pessoal no log: nem CEP, nem telefone, nem endereço, nem nome', async () => {
    await criarPedido(ENTRADA, portas().p);
    await criarPedido(ENTRADA, portas({ criarNoBanco: async () => ({ data: null, error: { code: '23514', message: 'check violation' } }) }).p);
    const texto = [...saida.erro.mock.calls, ...saida.info.mock.calls].flat().join('\n');
    expect(texto).toContain('pedidos.criar');
    for (const pessoal of ['20040002', '20040-002', '21900000000', '90000-0000', 'Rua de Exemplo', 'Ana Exemplo']) expect(texto).not.toContain(pessoal);
  });
});
