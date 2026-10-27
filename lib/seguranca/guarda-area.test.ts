import { describe, expect, it } from 'vitest';
import { guardaArea } from './guarda-area';
import { CASA_DO_PAPEL, PAPEIS } from './papeis';

describe('guarda de área', () => {
  it('erro ao ler o perfil explica, nunca redireciona (regra 2)', () => {
    expect(guardaArea({ perfil: { papel: 'cliente' }, erroAoLer: true, area: 'cliente' })).toEqual({ tipo: 'sem-acesso', causa: 'erro-ao-ler-perfil' });
    expect(guardaArea({ perfil: null, area: 'admin' }).tipo).toBe('sem-acesso');
  });

  it('papel desconhecido explica', () => {
    expect(guardaArea({ perfil: { papel: 'hacker' }, area: 'cliente' })).toEqual({ tipo: 'sem-acesso', causa: 'sem-papel' });
  });

  it('cliente na área admin vai para a casa dele', () => {
    expect(guardaArea({ perfil: { papel: 'cliente' }, area: 'admin' })).toEqual({ tipo: 'redirecionar', destino: '/conta' });
  });

  it('em toda combinação, o destino nunca é a casa da área atual (regra 1)', () => {
    for (const papel of [...PAPEIS, 'x', null]) {
      for (const area of PAPEIS) {
        for (const erroAoLer of [false, true]) {
          const r = guardaArea({ perfil: { papel }, erroAoLer, area });
          if (r.tipo === 'redirecionar') expect(r.destino).not.toBe(CASA_DO_PAPEL[area]);
        }
      }
    }
  });
});
