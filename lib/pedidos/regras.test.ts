import { describe, expect, it } from 'vitest';
import type { FreteRegiao } from '@/lib/catalogo/tipos';
import {
  conferirEntrada, MAXIMO_ITENS_NO_PEDIDO, montarPedido, normalizarTelefone, QUANTIDADE_MAXIMA, somaDasLinhas, totalDoPedido,
  type EntradaPedido,
} from './regras';

const V1 = '11111111-1111-4111-8111-111111111111';
const V2 = '22222222-2222-4222-8222-222222222222';

// Faixas da carga fictícia (DESCOBERTA.md §6b), como lerFretePorCep devolve para cada CEP.
const SP_CAPITAL: FreteRegiao[] = [
  { nome: 'Retirada no ateliê', cepInicio: '01000000', cepFim: '09999999', modo: 'retirada', valorCentavos: 0, prazoTexto: 'a combinar por WhatsApp' },
  { nome: 'Mesma cidade e região metropolitana', cepInicio: '01000000', cepFim: '09999999', modo: 'motoboy', valorCentavos: 1500, prazoTexto: '1 a 2 dias úteis' },
];
const INTERIOR: FreteRegiao[] = [
  { nome: 'Restante do estado', cepInicio: '11000000', cepFim: '19999999', modo: 'correios', valorCentavos: 2500, prazoTexto: '3 a 7 dias úteis' },
];

const BASE = { cep: '13010-000', modo: 'correios', telefone: '(19) 90000-0000', nome: 'Ana Exemplo', endereco: 'Rua de Exemplo, 10' };

function entrada(extra: Record<string, unknown> = {}): unknown {
  return { ...BASE, itens: [{ variacaoId: V1, quantidade: 1, precoCentavos: 2200 }], ...extra };
}

function conferida(bruto: unknown): EntradaPedido {
  const c = conferirEntrada(bruto);
  if (!c.ok) throw new Error(`entrada recusada: ${JSON.stringify(c.erros)}`);
  return c.entrada;
}

describe('total do pedido', () => {
  it('T17: 3 × R$ 85,00 + frete de R$ 25,00 = R$ 280,00, em centavos', () => {
    const e = conferida(entrada({ itens: [{ variacaoId: V1, quantidade: 3, precoCentavos: 8500 }] }));
    const m = montarPedido(e, INTERIOR);
    expect(m.ok && m.pedido.subtotalCentavos).toBe(25500);
    expect(m.ok && m.pedido.frete.valorCentavos).toBe(2500);
    expect(m.ok && m.pedido.totalCentavos).toBe(28000);
  });

  it('frete 0 da retirada é valor; sem frete escolhido, o total é só o subtotal (zero ≠ sem dado)', () => {
    expect(totalDoPedido(4400, 0)).toBe(4400);
    expect(totalDoPedido(4400, null)).toBe(4400);
    expect(totalDoPedido(4400, 1500)).toBe(5900);
    expect(somaDasLinhas([{ quantidade: 2, precoCentavos: 2200 }, { quantidade: 1, precoCentavos: 4500 }])).toBe(8900);
    expect(somaDasLinhas([])).toBe(0);
  });
});

describe('entrada do checkout (regra 3)', () => {
  it('T17b: quantidade -1, 0, acima do teto, fracionada ou em texto é recusada', () => {
    for (const quantidade of [-1, 0, QUANTIDADE_MAXIMA + 1, 1.5, '2', Number.NaN, null]) {
      const c = conferirEntrada(entrada({ itens: [{ variacaoId: V1, quantidade, precoCentavos: 2200 }] }));
      expect(c.ok, `quantidade ${String(quantidade)}`).toBe(false);
      expect(!c.ok && c.erros.itens).toBeTruthy();
    }
    expect(conferirEntrada(entrada({ itens: [{ variacaoId: V1, quantidade: QUANTIDADE_MAXIMA, precoCentavos: 2200 }] })).ok).toBe(true);
  });

  it('variação repetida, id que não é uuid, preço inválido, lista vazia ou acima do limite é recusada', () => {
    const item = { variacaoId: V1, quantidade: 1, precoCentavos: 2200 };
    const muitos = Array.from({ length: MAXIMO_ITENS_NO_PEDIDO + 1 }, (_, i) => ({ ...item, variacaoId: `${String(i).padStart(8, '0')}-1111-4111-8111-111111111111` }));
    for (const itens of [[], [item, item], [{ ...item, variacaoId: 'v-ale-90' }], [{ ...item, precoCentavos: 0 }], [{ ...item, precoCentavos: 22.5 }], muitos, 'x', null]) {
      expect(conferirEntrada(entrada({ itens })).ok, JSON.stringify(itens).slice(0, 60)).toBe(false);
    }
  });

  it('T17d: valor do frete, id da região, total e usuário vindos do formulário ficam de fora', () => {
    const e = conferida(entrada({
      freteCentavos: 0, regiaoId: 'regiao-mais-barata', totalCentavos: 1, usuarioId: 'outra-pessoa',
      itens: [{ variacaoId: V1, quantidade: 1, precoCentavos: 2200, freteCentavos: 0 }],
    }));
    expect(e).toEqual({
      itens: [{ variacaoId: V1, quantidade: 1, precoCentavos: 2200 }],
      cep: '13010000', modo: 'correios', telefone: '19900000000', nome: 'Ana Exemplo', endereco: 'Rua de Exemplo, 10',
    });
    // O frete sai das faixas do CEP, não do que o formulário disse.
    const m = montarPedido(e, INTERIOR);
    expect(m.ok && m.pedido.frete.valorCentavos).toBe(2500);
  });

  it('motoboy e retirada fora da faixa do CEP são recusados; dentro dela, valem', () => {
    expect(montarPedido(conferida(entrada({ modo: 'motoboy' })), INTERIOR)).toEqual({ ok: false, motivo: 'modo-fora-da-faixa' });
    expect(montarPedido(conferida(entrada({ modo: 'retirada' })), INTERIOR)).toEqual({ ok: false, motivo: 'modo-fora-da-faixa' });
    // Faixa de outro CEP na lista (consulta sem filtro): também não vale.
    expect(montarPedido(conferida(entrada({ modo: 'motoboy' })), SP_CAPITAL)).toEqual({ ok: false, motivo: 'modo-fora-da-faixa' });
    const m = montarPedido(conferida(entrada({ cep: '01310-100', modo: 'motoboy' })), SP_CAPITAL);
    expect(m.ok && m.pedido.totalCentavos).toBe(2200 + 1500);
  });

  it('retirada não leva endereço nem nome; correios e motoboy exigem os dois', () => {
    const retirada = conferida(entrada({ cep: '01310-100', modo: 'retirada', endereco: 'Rua A, 1', nome: 'Ana' }));
    expect(retirada.endereco).toBeNull();
    expect(retirada.nome).toBeNull();
    const sem = conferirEntrada(entrada({ endereco: '   ', nome: '' }));
    expect(!sem.ok && Object.keys(sem.erros).sort()).toEqual(['endereco', 'nome']);
    expect(conferirEntrada(entrada({ endereco: 'x'.repeat(201) })).ok).toBe(false);
  });

  it('CEP, modo e telefone inválidos dizem o campo', () => {
    const c = conferirEntrada(entrada({ cep: '0131', modo: 'drone', telefone: '9999' }));
    expect(!c.ok && Object.keys(c.erros).sort()).toEqual(['cep', 'modo', 'telefone']);
    expect(conferirEntrada(null).ok).toBe(false);
  });

  it('telefone: aceita DDD com máscara ou +55, fixo ou celular; recusa curto e DDD 0', () => {
    expect(normalizarTelefone('(11) 90000-0000')).toBe('11900000000');
    expect(normalizarTelefone('+55 11 90000-0000')).toBe('11900000000');
    expect(normalizarTelefone('1133334444')).toBe('1133334444');
    expect(normalizarTelefone('90000-0000')).toBeNull();
    expect(normalizarTelefone('(01) 90000-0000')).toBeNull();
  });

  it('pedido de 1 item ("Comprar agora", D-LO-8) e de vários itens passam', () => {
    expect(conferirEntrada(entrada()).ok).toBe(true);
    const dois = conferida(entrada({ itens: [{ variacaoId: V1, quantidade: 2, precoCentavos: 2200 }, { variacaoId: V2, quantidade: 1, precoCentavos: 4500 }] }));
    const m = montarPedido(dois, INTERIOR);
    expect(m.ok && m.pedido.totalCentavos).toBe(2 * 2200 + 4500 + 2500);
  });
});
