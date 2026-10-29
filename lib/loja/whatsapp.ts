// WhatsApp da loja. O número é FICTÍCIO (cliente fictício, repositório público) e mora só aqui:
// trocar pelo número real é mudar esta constante, na passagem para o cliente (PASSAGEM.md).
export const WHATSAPP_NUMERO_FICTICIO = '5500900000000';

export function linkWhatsapp(mensagem: string): string {
  return `https://wa.me/${WHATSAPP_NUMERO_FICTICIO}?text=${encodeURIComponent(mensagem)}`;
}

export function mensagemProduto(nome: string, aroma: string, tamanho: string): string {
  return `Olá! Tenho uma dúvida sobre o produto ${nome} (${aroma}, ${tamanho}).`;
}

export function mensagemProdutoSemVariacao(nome: string): string {
  return `Olá! Tenho uma dúvida sobre o produto ${nome}.`;
}

export function mensagemPedido(numero: string): string {
  return `Olá! Preciso de ajuda com o pedido nº ${numero}.`;
}

export const MENSAGEM_GERAL = 'Olá! Gostaria de falar com a loja.';
