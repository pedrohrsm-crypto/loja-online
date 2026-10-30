import { describe, expect, it } from 'vitest';
import type { Variacao } from '@/lib/catalogo/tipos';
import { alternativaDisponivel, aromasDe, tamanhosDe, trocarAroma, variacaoInicial } from './variacao';

function v(id: string, aroma: string, tamanho: string, precoCentavos: number, estoque: number): Variacao {
  return { id, produtoId: 'p', aroma, tamanho, precoCentavos, estoque, sku: id };
}

// Como o sabonete artesanal da carga fictícia, em ordem de preço.
const V = [
  v('sem90', 'sem fragrância', '90 g', 2000, 15),
  v('ale90', 'alecrim', '90 g', 2200, 18),
  v('lar90', 'laranja-doce', '90 g', 2200, 7),
  v('ale140', 'alecrim', '140 g', 3000, 12),
  v('lar140', 'laranja-doce', '140 g', 3000, 0),
];

describe('escolha de variação', () => {
  it('lista aromas sem repetir e tamanhos do aroma escolhido', () => {
    expect(aromasDe(V)).toEqual(['sem fragrância', 'alecrim', 'laranja-doce']);
    expect(tamanhosDe(V, 'alecrim').map((x) => x.tamanho)).toEqual(['90 g', '140 g']);
  });

  it('começa na mais barata que não esgotou; se tudo esgotou, na mais barata', () => {
    expect(variacaoInicial(V)?.id).toBe('sem90');
    expect(variacaoInicial([v('a', 'x', '1', 100, 0), v('b', 'y', '2', 200, 5)])?.id).toBe('b');
    expect(variacaoInicial([v('a', 'x', '1', 100, 0), v('b', 'y', '2', 200, 0)])?.id).toBe('a');
    expect(variacaoInicial([])).toBeNull();
  });

  it('trocar de aroma mantém o tamanho quando o aroma novo o tem', () => {
    const ale140 = V[3];
    expect(trocarAroma(V, ale140, 'laranja-doce').id).toBe('lar140');
    expect(trocarAroma(V, ale140, 'sem fragrância').id).toBe('sem90');
  });

  it('a alternativa para o esgotado é do mesmo aroma, senão qualquer disponível', () => {
    expect(alternativaDisponivel(V, V[4])?.id).toBe('lar90');
    expect(alternativaDisponivel([v('a', 'x', '1', 1, 0)], v('a', 'x', '1', 1, 0))).toBeNull();
  });
});
