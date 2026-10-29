// Escolha de variação na página do produto: regras puras, testadas na JVM do Node (vitest).
// O balão de tamanho mostra só o tamanho; o preço mostrado é o da variação escolhida.
import { estaEsgotada } from '@/lib/catalogo/preco';
import type { Variacao } from '@/lib/catalogo/tipos';

export function aromasDe(variacoes: readonly Variacao[]): string[] {
  return [...new Set(variacoes.map((v) => v.aroma))];
}

export function tamanhosDe(variacoes: readonly Variacao[], aroma: string): Variacao[] {
  return variacoes.filter((v) => v.aroma === aroma);
}

// Primeira variação a mostrar: a mais barata que não esgotou; se tudo esgotou, a mais barata.
export function variacaoInicial(variacoes: readonly Variacao[]): Variacao | null {
  return variacoes.find((v) => !estaEsgotada(v)) ?? variacoes[0] ?? null;
}

// Ao trocar de aroma, mantém o tamanho quando o aroma novo o tem; senão, a mais barata disponível.
export function trocarAroma(variacoes: readonly Variacao[], atual: Variacao, aroma: string): Variacao {
  const doAroma = tamanhosDe(variacoes, aroma);
  return (
    doAroma.find((v) => v.tamanho === atual.tamanho) ??
    doAroma.find((v) => !estaEsgotada(v)) ??
    doAroma[0] ??
    atual
  );
}

// Esgotada: outra variação do mesmo produto que o comprador pode levar (mesmo aroma primeiro).
export function alternativaDisponivel(variacoes: readonly Variacao[], atual: Variacao): Variacao | null {
  const livres = variacoes.filter((v) => v.id !== atual.id && !estaEsgotada(v));
  return livres.find((v) => v.aroma === atual.aroma) ?? livres[0] ?? null;
}
