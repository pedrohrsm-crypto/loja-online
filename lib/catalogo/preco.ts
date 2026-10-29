// Preço em centavos → texto da vitrine ("R$ 22,00"). O único lugar que formata dinheiro.
// Sem Intl de propósito: o separador do ICU muda entre builds do Node, e o texto precisa
// ser o mesmo na bancada, no CI e na Vercel. Entre "R$" e o número vai espaço inseparável
// (U+00A0), para o preço não quebrar em duas linhas a 360 px.
import type { Variacao } from './tipos';

export const ESPACO_INSEPARAVEL = ' ';

export function formatarPreco(centavos: number): string {
  if (!Number.isSafeInteger(centavos) || centavos < 0) {
    throw new RangeError(`preço em centavos inválido: ${centavos}`);
  }
  const reais = Math.floor(centavos / 100);
  const resto = String(centavos % 100).padStart(2, '0');
  const milhar = String(reais).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `R$${ESPACO_INSEPARAVEL}${milhar},${resto}`;
}

// "a partir de": o menor preço entre as variações. Nenhuma variação → null (sem preço a mostrar).
export function menorPreco(variacoes: readonly Pick<Variacao, 'precoCentavos'>[]): number | null {
  if (variacoes.length === 0) return null;
  return Math.min(...variacoes.map((v) => v.precoCentavos));
}

// Esgotada: estoque zero. A tela, o carrinho e o checkout perguntam aqui.
export function estaEsgotada(variacao: Pick<Variacao, 'estoque'>): boolean {
  return variacao.estoque <= 0;
}
