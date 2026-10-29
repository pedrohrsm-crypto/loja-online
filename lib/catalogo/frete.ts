// Regras puras do frete por CEP (DESCOBERTA.md §6b; FIDELIDADE.md §1, regra 3).
// A região sai do CEP, nunca de um id vindo do formulário.
import { MODOS_FRETE, type FreteRegiao } from './tipos';

// "01310-100" ou "01310100" → "01310100". Qualquer outra forma → null.
export function normalizarCep(entrada: string): string | null {
  const m = /^(\d{5})-?(\d{3})$/.exec(entrada.trim());
  return m ? m[1] + m[2] : null;
}

// Das faixas lidas do banco, uma opção por modo: a faixa mais estreita que contém o CEP
// (a de motoboy da cidade ganha de uma faixa larga do mesmo modo). Confere a faixa de
// novo aqui: se a consulta vier sem filtro, nenhum CEP leva frete de outra região.
export function escolherFretes(faixas: readonly FreteRegiao[], cep: string): FreteRegiao[] {
  const porModo = new Map<FreteRegiao['modo'], FreteRegiao>();
  for (const f of faixas) {
    if (f.cepInicio > cep || f.cepFim < cep) continue;
    const atual = porModo.get(f.modo);
    if (!atual || largura(f) < largura(atual) || (largura(f) === largura(atual) && f.valorCentavos < atual.valorCentavos)) {
      porModo.set(f.modo, f);
    }
  }
  return [...porModo.values()].sort(
    (a, b) => a.valorCentavos - b.valorCentavos || MODOS_FRETE.indexOf(a.modo) - MODOS_FRETE.indexOf(b.modo),
  );
}

function largura(f: FreteRegiao): number {
  return Number(f.cepFim) - Number(f.cepInicio);
}
