import type { Metadata } from 'next';
import { Fraunces, Inter } from 'next/font/google';
import Link from 'next/link';
import { Cabecalho } from '@/components/cabecalho';
import { NavegacaoLoja } from '@/components/navegacao-loja';
import './globals.css';

// Fontes auto-hospedadas pelo next/font (sem pedido ao Google no navegador). Títulos em serifa
// (Fraunces) e texto em Inter; só os pesos usados e só o subconjunto latino (cobre o pt-BR).
const fonteTitulo = Fraunces({ subsets: ['latin'], weight: ['600', '700'], display: 'swap', variable: '--fonte-titulo' });
const fonteTexto = Inter({ subsets: ['latin'], weight: ['400', '600', '700'], display: 'swap', variable: '--fonte-texto' });

export const metadata: Metadata = {
  title: { default: 'Ateliê Alecrim', template: '%s · Ateliê Alecrim' },
  description: 'Cosméticos artesanais do Ateliê Alecrim (loja de demonstração).',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="pt-BR" className={`${fonteTitulo.variable} ${fonteTexto.variable}`}>
      <body className="flex min-h-screen flex-col bg-fundo text-texto">
        <a href="#conteudo" className="pular-para-conteudo">Pular para o conteúdo</a>
        <Cabecalho />
        <main id="conteudo" tabIndex={-1} className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
        <footer className="border-t border-borda">
          <div className="mx-auto flex max-w-5xl flex-wrap gap-x-4 px-4 py-2 text-sm">
            <Link href="/privacidade" className="inline-flex min-h-11 items-center underline underline-offset-4">Privacidade</Link>
          </div>
        </footer>
        <NavegacaoLoja />
      </body>
    </html>
  );
}
