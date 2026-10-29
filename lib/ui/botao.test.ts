import { describe, expect, it } from 'vitest';
import { ESTILOS_BOTAO, estiloBotao, type VarianteBotao } from './botao';

const classes = (v: VarianteBotao) => new Set(ESTILOS_BOTAO[v].split(' '));
const VARIANTES = Object.keys(ESTILOS_BOTAO) as VarianteBotao[];

describe('estilos de botão', () => {
  it('a ação destrutiva não compartilha cor com o primário de compra', () => {
    for (const perigo of ['perigo', 'perigo-contorno'] as const) {
      const cores = [...classes(perigo)].filter((c) => /^(bg|text|border)-(?!center)/.test(c));
      expect(cores.length).toBeGreaterThan(0);
      for (const c of cores) expect(classes('primario').has(c), `${perigo} repete ${c}`).toBe(false);
    }
  });

  it('todo botão tem alvo mínimo de 2,75 rem nas duas dimensões', () => {
    for (const v of VARIANTES) {
      expect(classes(v).has('min-h-11'), v).toBe(true);
      expect(classes(v).has('min-w-11'), v).toBe(true);
    }
  });

  it('acrescenta classes extras sem perder as do estilo', () => {
    expect(estiloBotao('primario', 'w-full')).toBe(`${ESTILOS_BOTAO.primario} w-full`);
  });
});
