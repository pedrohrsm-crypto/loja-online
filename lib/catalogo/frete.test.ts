import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { escolherFretes, normalizarCep } from './frete';
import { FAIXAS } from './faixas-de-teste';
import { MODOS_FRETE, type FreteRegiao } from './tipos';

describe('normalizarCep', () => {
  it('aceita com e sem hífen, e espaço nas pontas', () => {
    expect(normalizarCep('01310-100')).toBe('01310100');
    expect(normalizarCep('01310100')).toBe('01310100');
    expect(normalizarCep(' 01310-100 ')).toBe('01310100');
  });

  it('recusa o que não é CEP de 8 dígitos', () => {
    for (const cep of ['', '0131010', '013101000', '0131-0100', '01310–100', 'abcde-fgh', '01.310-100', '01310 100']) {
      expect(normalizarCep(cep), cep).toBeNull();
    }
  });
});

describe('escolherFretes', () => {
  it('região metropolitana: retirada e motoboy, do mais barato ao mais caro', () => {
    expect(escolherFretes(FAIXAS, '05010000').map((f) => f.modo)).toEqual(['retirada', 'motoboy']);
  });

  it('cada faixa de correios no seu CEP, incluindo as pontas', () => {
    expect(escolherFretes(FAIXAS, '11000000').map((f) => f.valorCentavos)).toEqual([2500]);
    expect(escolherFretes(FAIXAS, '39999999').map((f) => f.valorCentavos)).toEqual([3000]);
    expect(escolherFretes(FAIXAS, '40000000').map((f) => f.valorCentavos)).toEqual([4000]);
    expect(escolherFretes(FAIXAS, '90000000').map((f) => f.nome)).toEqual(['Sudeste e Sul']);
  });

  it('fora de qualquer faixa: nenhuma opção, mesmo que a consulta traga faixas de outra região', () => {
    expect(escolherFretes(FAIXAS, '00500000')).toEqual([]);
    expect(escolherFretes(FAIXAS, '10500000')).toEqual([]);
  });

  it('duas faixas do mesmo modo: ganha a mais estreita', () => {
    const larga: FreteRegiao = { ...FAIXAS[0], nome: 'Estado inteiro', cepInicio: '01000000', cepFim: '19999999', valorCentavos: 1000 };
    expect(escolherFretes([larga, FAIXAS[0]], '05010000').map((f) => f.nome)).toEqual(['Mesma cidade e região metropolitana']);
    expect(escolherFretes([FAIXAS[0], larga], '05010000').map((f) => f.nome)).toEqual(['Mesma cidade e região metropolitana']);
  });
});

describe('modos de frete', () => {
  it('o CHECK de fretes_regiao.modo na migration tem exatamente MODOS_FRETE', () => {
    const pasta = join(__dirname, '..', '..', 'supabase', 'migrations');
    const sql = readdirSync(pasta).sort().map((f) => readFileSync(join(pasta, f), 'utf8')).join('\n');
    // Ancorado na tabela: pedidos também tem uma coluna `modo` (teste/produção).
    const m = sql.match(/create table public\.fretes_regiao[\s\S]*?modo\s+text[^,]*check\s*\(\s*modo\s+in\s*\(([^)]*)\)/i);
    expect(m, 'CHECK de fretes_regiao.modo não encontrado').not.toBeNull();
    expect([...m![1].matchAll(/'([^']+)'/g)].map((x) => x[1]).sort()).toEqual([...MODOS_FRETE].sort());
  });
});
