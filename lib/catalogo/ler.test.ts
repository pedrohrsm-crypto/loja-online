import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { FAIXAS } from './faixas-de-teste';
import { LIMITE_MAXIMO_PRODUTOS, lerFretePorCep, lerProdutoPorSlug, limitar, listarCategoriasPublicadas, listarProdutosPublicados } from './ler';

vi.spyOn(console, 'error').mockImplementation(() => {});

type Chamada = [metodo: string, ...args: unknown[]];
type Resposta = { data: unknown; error: { code?: string; message: string } | null };

// Imita o construtor de consulta do supabase-js: registra cada chamada e, no `await`,
// devolve a resposta combinada.
function bancoFalso(resposta: Resposta) {
  const chamadas: Chamada[] = [];
  const consulta: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'lte', 'gte', 'order', 'limit', 'maybeSingle']) {
    consulta[m] = (...args: unknown[]) => {
      chamadas.push([m, ...args]);
      return consulta;
    };
  }
  consulta.then = (ok: (r: Resposta) => unknown) => Promise.resolve(resposta).then(ok);
  const db = {
    from: (tabela: string) => {
      chamadas.push(['from', tabela]);
      return consulta;
    },
  } as unknown as SupabaseClient;
  return { db, chamadas };
}

const LINHA_FRETE = (f: (typeof FAIXAS)[number]) => ({
  nome: f.nome, cep_inicio: f.cepInicio, cep_fim: f.cepFim, modo: f.modo, valor_centavos: f.valorCentavos, prazo_texto: f.prazoTexto,
});

describe('lerFretePorCep', () => {
  it('CEP inválido não chega ao banco', async () => {
    for (const cep of ['', '1234', 'abcde-fgh', '0131-0100', '01310-1000']) {
      const { db, chamadas } = bancoFalso({ data: [], error: null });
      expect(await lerFretePorCep(cep, db), cep).toEqual({ ok: false, motivo: 'cep-invalido' });
      expect(chamadas).toEqual([]);
    }
  });

  it('CEP com hífen consulta pelos 8 dígitos e devolve as opções da faixa', async () => {
    const { db, chamadas } = bancoFalso({ data: FAIXAS.slice(0, 2).map(LINHA_FRETE), error: null });
    const r = await lerFretePorCep('05010-000', db);
    expect(r.ok && r.cep).toBe('05010000');
    expect(r.ok && r.opcoes.map((o) => o.modo)).toEqual(['retirada', 'motoboy']);
    expect(chamadas).toContainEqual(['lte', 'cep_inicio', '05010000']);
    expect(chamadas).toContainEqual(['gte', 'cep_fim', '05010000']);
  });

  it('CEP fora de faixa: sem frete, também se o banco devolver faixa de outra região', async () => {
    expect(await lerFretePorCep('00500-000', bancoFalso({ data: [], error: null }).db)).toEqual({ ok: false, motivo: 'sem-frete' });
    expect(await lerFretePorCep('00500-000', bancoFalso({ data: FAIXAS.map(LINHA_FRETE), error: null }).db)).toEqual({ ok: false, motivo: 'sem-frete' });
  });

  it('pede só as colunas do GRANT, com limit e ordem explícitos', async () => {
    const { db, chamadas } = bancoFalso({ data: [], error: null });
    await lerFretePorCep('20000-000', db);
    expect(chamadas).toContainEqual(['from', 'fretes_regiao']);
    expect(chamadas).toContainEqual(['select', 'nome, cep_inicio, cep_fim, modo, valor_centavos, prazo_texto']);
    expect(chamadas.some(([m]) => m === 'order')).toBe(true);
    expect(chamadas.some(([m]) => m === 'limit')).toBe(true);
  });

  it('erro do banco nunca vira "sem frete"', async () => {
    const r = await lerFretePorCep('20000-000', bancoFalso({ data: null, error: { code: '42501', message: 'permissão negada' } }).db);
    expect(r).toEqual({ ok: false, motivo: 'indisponivel' });
  });
});

const LINHA_PRODUTO = {
  id: 'p1', categoria_id: 'c1', slug: 'sabonete-artesanal', nome: 'Sabonete artesanal', descricao: 'd', modo_de_uso: 'm', ingredientes: 'i',
  criado_em: '2026-10-29T00:00:00Z', atualizado_em: '2026-10-29T00:00:00Z', categorias: { slug: 'sabonetes', nome: 'Sabonetes' },
  variacoes: [{ id: 'v1', produto_id: 'p1', aroma: 'alecrim', tamanho: '90 g', preco_centavos: 2200, estoque: 18, sku: 'SAB-ART-ALE-090' }],
};

describe('listarProdutosPublicados', () => {
  it('filtra publicado no produto, na categoria e nas variações, com limit e ordem', async () => {
    const { db, chamadas } = bancoFalso({ data: [LINHA_PRODUTO], error: null });
    const r = await listarProdutosPublicados({ categoria: 'sabonetes', limite: 12 }, db);
    expect(r.ok && r.dados[0]).toMatchObject({ slug: 'sabonete-artesanal', categoria: { slug: 'sabonetes' }, variacoes: [{ precoCentavos: 2200, sku: 'SAB-ART-ALE-090' }] });
    expect(chamadas).toContainEqual(['eq', 'publicado', true]);
    expect(chamadas).toContainEqual(['eq', 'categorias.publicado', true]);
    expect(chamadas).toContainEqual(['eq', 'variacoes.publicado', true]);
    expect(chamadas).toContainEqual(['eq', 'categorias.slug', 'sabonetes']);
    expect(chamadas).toContainEqual(['limit', 12]);
    expect(chamadas).toContainEqual(['order', 'nome']);
  });

  it('o limite tem teto: ninguém pede "tudo"', async () => {
    const { db, chamadas } = bancoFalso({ data: [], error: null });
    await listarProdutosPublicados({ limite: 100_000 }, db);
    expect(chamadas).toContainEqual(['limit', LIMITE_MAXIMO_PRODUTOS]);
    expect(limitar(0, 10)).toBe(1);
    expect(limitar(Number.NaN, 10)).toBe(1);
    expect(limitar(3.9, 10)).toBe(3);
  });

  it('erro do banco nunca vira lista vazia', async () => {
    const r = await listarProdutosPublicados({ limite: 12 }, bancoFalso({ data: null, error: { code: '42P01', message: 'relation "produtos" does not exist' } }).db);
    expect(r).toEqual({ ok: false, motivo: 'indisponivel' });
  });

  it('categoria com slug inválido não chega ao banco', async () => {
    const { db, chamadas } = bancoFalso({ data: [LINHA_PRODUTO], error: null });
    expect(await listarProdutosPublicados({ categoria: "x' or 1=1", limite: 12 }, db)).toEqual({ ok: true, dados: [] });
    expect(chamadas).toEqual([]);
  });
});

describe('lerProdutoPorSlug e listarCategoriasPublicadas', () => {
  it('não achou → dados null (404), e erro → indisponivel', async () => {
    expect(await lerProdutoPorSlug('nao-existe', bancoFalso({ data: null, error: null }).db)).toEqual({ ok: true, dados: null });
    expect(await lerProdutoPorSlug('x', bancoFalso({ data: null, error: { message: 'falhou' } }).db)).toEqual({ ok: false, motivo: 'indisponivel' });
    const { db, chamadas } = bancoFalso({ data: LINHA_PRODUTO, error: null });
    const r = await lerProdutoPorSlug('sabonete-artesanal', db);
    expect(r.ok && r.dados?.variacoes).toHaveLength(1);
    expect(chamadas).toContainEqual(['eq', 'publicado', true]);
  });

  it('categorias publicadas em ordem, com limit; erro → indisponivel', async () => {
    const { db, chamadas } = bancoFalso({ data: [{ id: 'c1', slug: 'sabonetes', nome: 'Sabonetes', ordem: 1 }], error: null });
    expect(await listarCategoriasPublicadas(db)).toEqual({ ok: true, dados: [{ id: 'c1', slug: 'sabonetes', nome: 'Sabonetes', ordem: 1 }] });
    expect(chamadas).toContainEqual(['eq', 'publicado', true]);
    expect(chamadas).toContainEqual(['order', 'ordem']);
    expect(chamadas.some(([m]) => m === 'limit')).toBe(true);
    expect(await listarCategoriasPublicadas(bancoFalso({ data: null, error: { message: 'x' } }).db)).toEqual({ ok: false, motivo: 'indisponivel' });
  });
});
