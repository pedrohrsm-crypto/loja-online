import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Produto', template: '%s · Produto' },
  description: 'Produto construído com o starter do Framework Aprendido.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-fundo text-texto">
        <a href="#conteudo" className="pular-para-conteudo">Pular para o conteúdo</a>
        <header className="border-b border-borda">
          <nav aria-label="Principal" className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-3">
            <Link href="/" className="font-semibold">Produto</Link>
            <ul className="flex flex-wrap gap-4">
              <li><Link href="/conta" className="underline-offset-4 hover:underline">Minha conta</Link></li>
              <li><Link href="/privacidade" className="underline-offset-4 hover:underline">Privacidade</Link></li>
            </ul>
          </nav>
        </header>
        <main id="conteudo" tabIndex={-1} className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
