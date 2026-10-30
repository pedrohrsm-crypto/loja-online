import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { lerProdutoPorSlug } from '@/lib/catalogo/ler';
import { ErroCatalogo } from '@/components/loja/erro-catalogo';
import { ProdutoVista } from '@/components/loja/produto-vista';

// Metadados e página leem o mesmo produto na mesma requisição.
const lerProduto = cache(lerProdutoPorSlug);

export async function generateMetadata({ params }: PageProps<'/produto/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const leitura = await lerProduto(slug);
  return { title: leitura.ok && leitura.dados ? leitura.dados.nome : 'Produto' };
}

export default async function PaginaProduto({ params }: PageProps<'/produto/[slug]'>) {
  const { slug } = await params;
  const leitura = await lerProduto(slug);
  // Falha de leitura NÃO é "produto inexistente": a tela diz que não conseguiu carregar.
  if (!leitura.ok) return <ErroCatalogo href={`/produto/${encodeURIComponent(slug)}`} />;
  // Link antigo de post, rascunho ou categoria fora do ar: 404 com a tela "não está mais à venda".
  if (!leitura.dados) notFound();
  return <ProdutoVista produto={leitura.dados} />;
}
