// Valor em reais para o Mercado Pago (T17). A Orders API recebe e devolve o valor como TEXTO decimal
// ("85.00"), e a loja guarda centavos inteiros. As duas conversões moram só aqui: nada de float, nada
// de vírgula (04, categoria 3).

/** 8500 → "85.00". Recusa o que não é inteiro positivo: valor errado nunca vira cobrança. */
export function centavosParaMP(centavos: number): string {
  if (!Number.isSafeInteger(centavos) || centavos <= 0) throw new RangeError(`valor inválido para cobrança: ${centavos}`);
  const reais = Math.trunc(centavos / 100);
  const resto = centavos % 100;
  return `${reais}.${String(resto).padStart(2, '0')}`;
}

/** "85.00" → 8500; "85.5" → 8550; "85" → 8500. Formato fora disso (vírgula, sinal, 3 casas) → null. */
export function mpParaCentavos(texto: unknown): number | null {
  if (typeof texto !== 'string') return null;
  const m = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(texto.trim());
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? '0').padEnd(2, '0'));
}
