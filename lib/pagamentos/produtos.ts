// Catálogo do trabalho: muda por cliente (docs/freelance/PROPOSTA.md §1).
// O preço de verdade mora no Stripe; aqui fica o id do preço (por variável de ambiente,
// porque teste e produção têm ids diferentes: 04, erro 3.6) e o valor para exibir e conferir.
export type Produto = { slug: string; nome: string; valorCentavos: number; variavelPreco: string };

export const PRODUTOS: Record<string, Produto> = {
  curso: { slug: 'curso', nome: 'Curso completo', valorCentavos: 19700, variavelPreco: 'STRIPE_PRECO_CURSO' },
};

export function precoDoStripe(produto: Produto): string | null {
  return process.env[produto.variavelPreco] ?? null;
}

export function formatarReais(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
