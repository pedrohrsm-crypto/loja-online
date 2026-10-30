import type { Metadata } from 'next';
import Link from 'next/link';
import { Cabecalho } from '@/components/cabecalho';
import { NavegacaoLoja } from '@/components/navegacao-loja';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Ateliê Alecrim', template: '%s · Ateliê Alecrim' },
  description: 'Cosméticos artesanais do Ateliê Alecrim (loja de demonstração).',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="pt-BR">
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
