// Textos do frete na interface. A leitura é de lib/catalogo/ (lerFretePorCep); aqui só a redação.
import { formatarPreco } from '@/lib/catalogo/preco';
import { normalizarCep } from '@/lib/catalogo/frete';
import type { ModoFrete } from '@/lib/catalogo/tipos';

export const ROTULO_MODO: Record<ModoFrete, string> = {
  correios: 'Correios',
  motoboy: 'Motoboy',
  retirada: 'Retirada (combinamos pelo WhatsApp)',
};

export const MENSAGEM_FRETE: Record<'cep-invalido' | 'sem-frete' | 'indisponivel', string> = {
  'cep-invalido': 'O CEP precisa ter 8 números. Exemplo: 01310-100.',
  'sem-frete': 'Ainda não entregamos neste CEP. Fale com a gente pelo WhatsApp para combinar.',
  indisponivel: 'Não conseguimos calcular o frete agora. Tente de novo em instantes.',
};

export function textoValorFrete(valorCentavos: number): string {
  return valorCentavos === 0 ? 'Grátis' : formatarPreco(valorCentavos);
}

// Formata na saída do campo (blur), nunca a cada tecla: "01310100" → "01310-100".
// Entrada que não é CEP volta como o comprador digitou, para ele corrigir.
export function formatarCepNoBlur(entrada: string): string {
  const cep = normalizarCep(entrada);
  return cep ? `${cep.slice(0, 5)}-${cep.slice(5)}` : entrada.trim();
}

