import { describe, expect, it } from 'vitest';
import {
  adicionar, contarUnidades, continuarComDisponiveis, definirQuantidade, lerCarrinhoSeguro, limitarQuantidade, QUANTIDADE_MAXIMA,
  remover, situacaoDoItem, subtotalCentavos, tetoDoItem, type ItemCarrinho,
} from './carrinho';

const SAB: ItemCarrinho = { variacaoId: 'v1', slug: 'sabonete-artesanal', nome: 'Sabonete artesanal', aroma: 'lavanda', tamanho: '90 g', precoCentavos: 2000, quantidade: 2 };
const VELA: ItemCarrinho = { variacaoId: 'v2', slug: 'vela-aromatica', nome: 'Vela aromática', aroma: 'alecrim', tamanho: '150 g', precoCentavos: 4500, quantidade: 1 };
const { quantidade: _q, ...SEM_QTD } = SAB;
void _q;

describe('quantidade', () => {
  it('fica entre 1 e o menor entre estoque e o teto', () => {
    expect(limitarQuantidade(0, 5)).toBe(1);
    expect(limitarQuantidade(9, 5)).toBe(5);
    expect(limitarQuantidade(99)).toBe(QUANTIDADE_MAXIMA);
    expect(limitarQuantidade(Number.NaN)).toBe(1);
    expect(limitarQuantidade(2.9, 5)).toBe(2);
  });

  it('estoque zero não derruba a quantidade abaixo de 1 (quem trata esgotado é a situação do item)', () => {
    expect(limitarQuantidade(3, 0)).toBe(1);
  });
});

describe('teto por item (uma regra só)', () => {
  it('é o estoque, até o máximo por item, e nunca negativo', () => {
    expect(tetoDoItem(3)).toBe(3);
    expect(tetoDoItem(50)).toBe(QUANTIDADE_MAXIMA);
    expect(tetoDoItem(0)).toBe(0);
    expect(tetoDoItem(-4)).toBe(0);
    expect(tetoDoItem(Number.NaN)).toBe(0);
  });
});

describe('operações do carrinho', () => {
  it('adicionar o mesmo item soma 1 e nunca passa do estoque', () => {
    expect(adicionar([SAB], SEM_QTD, 5)[0].quantidade).toBe(3);
    expect(adicionar([{ ...SAB, quantidade: 5 }], SEM_QTD, 5)[0].quantidade).toBe(5);
  });

  it('adicionar item novo entra com quantidade 1', () => {
    const r = adicionar([SAB], { ...SEM_QTD, variacaoId: 'v9' }, 5);
    expect(r).toHaveLength(2);
    expect(r[1].quantidade).toBe(1);
  });

  it('definir quantidade e remover mexem só no item pedido', () => {
    expect(definirQuantidade([SAB, VELA], 'v2', 4)[1].quantidade).toBe(4);
    expect(definirQuantidade([SAB, VELA], 'v2', 4)[0].quantidade).toBe(2);
    expect(remover([SAB, VELA], 'v1')).toEqual([VELA]);
  });

  it('conta unidades, não linhas ("3 itens" em todas as telas)', () => {
    expect(contarUnidades([SAB, VELA])).toBe(3);
  });
});

describe('conferência com o catálogo de hoje', () => {
  it('esgotado, fora do ar, preço que mudou e tudo certo', () => {
    expect(situacaoDoItem(SAB, { precoCentavos: 2000, estoque: 0 })).toEqual({ tipo: 'esgotado' });
    expect(situacaoDoItem(SAB, undefined)).toEqual({ tipo: 'indisponivel' });
    expect(situacaoDoItem(SAB, { precoCentavos: 2200, estoque: 8 })).toEqual({ tipo: 'preco-mudou', precoAntesCentavos: 2000, precoAgoraCentavos: 2200 });
    expect(situacaoDoItem(SAB, { precoCentavos: 2000, estoque: 8 })).toEqual({ tipo: 'ok' });
  });

  it('item salvo acima do estoque é marcado, e o subtotal só conta o disponível', () => {
    const cinco = { ...SAB, quantidade: 5 };
    expect(situacaoDoItem(cinco, { precoCentavos: 2000, estoque: 3 })).toEqual({ tipo: 'acima-do-estoque', disponivel: 3 });
    expect(situacaoDoItem(cinco, { precoCentavos: 2000, estoque: 5 })).toEqual({ tipo: 'ok' });
    expect(subtotalCentavos([cinco], { v1: { precoCentavos: 2000, estoque: 3 } })).toBe(3 * 2000);
    expect(continuarComDisponiveis([cinco], { v1: { precoCentavos: 2000, estoque: 3 } })[0].quantidade).toBe(3);
  });

  it('o teto por item também vale quando o estoque é maior', () => {
    const doze = { ...SAB, quantidade: QUANTIDADE_MAXIMA };
    expect(situacaoDoItem(doze, { precoCentavos: 2000, estoque: 50 })).toEqual({ tipo: 'ok' });
  });

  it('o subtotal usa o preço de hoje e deixa de fora o esgotado e o que saiu do ar', () => {
    const atuais = { v1: { precoCentavos: 2200, estoque: 8 }, v2: { precoCentavos: 4500, estoque: 0 } };
    expect(subtotalCentavos([SAB, VELA], atuais)).toBe(2 * 2200);
    expect(subtotalCentavos([SAB, VELA], { v1: atuais.v1 })).toBe(2 * 2200);
  });

  it('sem conferência (ainda carregando), o subtotal usa o preço salvo', () => {
    expect(subtotalCentavos([SAB, VELA])).toBe(2 * 2000 + 4500);
  });

  it('"continuar com o que está disponível" remove o esgotado, aceita o preço novo e respeita o estoque', () => {
    const atuais = { v1: { precoCentavos: 2200, estoque: 1 }, v2: { precoCentavos: 4500, estoque: 0 } };
    const r = continuarComDisponiveis([SAB, VELA], atuais);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ variacaoId: 'v1', precoCentavos: 2200, quantidade: 1 });
  });
});

describe('leitura do localStorage (nunca confiar no texto salvo)', () => {
  it('texto ausente, quebrado ou de outro formato vira carrinho vazio, sem exceção', () => {
    expect(lerCarrinhoSeguro(null)).toEqual([]);
    expect(lerCarrinhoSeguro('{quebrado')).toEqual([]);
    expect(lerCarrinhoSeguro('{"a":1}')).toEqual([]);
  });

  it('mantém o item válido, descarta o inválido e o repetido, e corrige a quantidade', () => {
    const texto = JSON.stringify([SAB, { ...VELA, precoCentavos: -5 }, { ...SAB }, { ...VELA, quantidade: 500 }, null, 'x']);
    const r = lerCarrinhoSeguro(texto);
    expect(r.map((i) => i.variacaoId)).toEqual(['v1', 'v2']);
    expect(r[1].quantidade).toBe(QUANTIDADE_MAXIMA);
  });

  it('preço fracionado não passa (dinheiro é centavo inteiro)', () => {
    expect(lerCarrinhoSeguro(JSON.stringify([{ ...SAB, precoCentavos: 20.5 }]))).toEqual([]);
  });
});
