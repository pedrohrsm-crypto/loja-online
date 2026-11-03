import { describe, expect, it } from 'vitest';
import { guardaArea, type SegundoFator } from './guarda-area';
import { CASA_DO_PAPEL, PAPEIS, PREFIXOS_PROTEGIDOS, TELA_SEGUNDO_FATOR } from './papeis';

const AAL1: SegundoFator = { nivel: 'aal1' };
const AAL2: SegundoFator = { nivel: 'aal2' };

describe('guarda de área', () => {
  it('erro ao ler o perfil explica, nunca redireciona (regra 2)', () => {
    expect(guardaArea({ perfil: { papel: 'cliente' }, erroAoLer: true, area: 'cliente' })).toEqual({ tipo: 'sem-acesso', causa: 'erro-ao-ler-perfil' });
    expect(guardaArea({ perfil: null, area: 'admin' }).tipo).toBe('sem-acesso');
  });

  it('papel desconhecido explica', () => {
    expect(guardaArea({ perfil: { papel: 'hacker' }, area: 'cliente' })).toEqual({ tipo: 'sem-acesso', causa: 'sem-papel' });
  });

  it('cliente na área admin vai para a casa dele, mesmo com aal2', () => {
    expect(guardaArea({ perfil: { papel: 'cliente' }, area: 'admin' })).toEqual({ tipo: 'redirecionar', destino: '/conta' });
    expect(guardaArea({ perfil: { papel: 'cliente' }, area: 'admin', segundoFator: AAL2 })).toEqual({ tipo: 'redirecionar', destino: '/conta' });
  });

  it('em toda combinação, o destino nunca é a casa nem o prefixo da área atual (regra 1)', () => {
    for (const papel of [...PAPEIS, 'x', null]) {
      for (const area of PAPEIS) {
        for (const erroAoLer of [false, true]) {
          for (const segundoFator of [undefined, AAL1, AAL2, { nivel: null }, { nivel: 'aal2', erroAoLer: true }]) {
            const r = guardaArea({ perfil: { papel }, erroAoLer, area, segundoFator, caminho: CASA_DO_PAPEL[area] });
            if (r.tipo !== 'redirecionar') continue;
            expect(r.destino).not.toBe(CASA_DO_PAPEL[area]);
            for (const prefixo of PREFIXOS_PROTEGIDOS) {
              if (CASA_DO_PAPEL[area].startsWith(prefixo)) expect(r.destino.startsWith(prefixo), `${papel} em ${area}: ${r.destino}`).toBe(false);
            }
          }
        }
      }
    }
  });
});

describe('segundo fator do painel (regra 1 da FIDELIDADE §1; S-03)', () => {
  it('a dona com aal2 entra no painel', () => {
    expect(guardaArea({ perfil: { papel: 'admin' }, area: 'admin', segundoFator: AAL2 })).toEqual({ tipo: 'ok' });
  });

  it('a dona com aal1 vai para o desafio do TOTP com a volta, nunca para /conta', () => {
    const r = guardaArea({ perfil: { papel: 'admin' }, area: 'admin', segundoFator: AAL1, caminho: '/admin/pedidos' });
    expect(r).toEqual({ tipo: 'redirecionar', destino: `${TELA_SEGUNDO_FATOR}?volta=%2Fadmin%2Fpedidos` });
  });

  it('a volta maliciosa não segue para o desafio', () => {
    expect(guardaArea({ perfil: { papel: 'admin' }, area: 'admin', segundoFator: AAL1, caminho: '//mal.com' })).toEqual({ tipo: 'redirecionar', destino: TELA_SEGUNDO_FATOR });
  });

  it('nível não lido ou ilegível explica, não redireciona (regra 2)', () => {
    expect(guardaArea({ perfil: { papel: 'admin' }, area: 'admin' })).toEqual({ tipo: 'sem-acesso', causa: 'erro-ao-ler-perfil' });
    expect(guardaArea({ perfil: { papel: 'admin' }, area: 'admin', segundoFator: { nivel: 'aal2', erroAoLer: true } })).toEqual({ tipo: 'sem-acesso', causa: 'erro-ao-ler-perfil' });
  });

  it('o comprador não é afetado: a área do cliente abre com aal1 ou sem nível lido', () => {
    expect(guardaArea({ perfil: { papel: 'cliente' }, area: 'cliente' })).toEqual({ tipo: 'ok' });
    expect(guardaArea({ perfil: { papel: 'cliente' }, area: 'cliente', segundoFator: AAL1 })).toEqual({ tipo: 'ok' });
    expect(guardaArea({ perfil: { papel: 'admin' }, area: 'cliente', segundoFator: AAL1 })).toEqual({ tipo: 'ok' });
  });
});
