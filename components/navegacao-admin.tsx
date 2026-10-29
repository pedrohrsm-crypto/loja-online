'use client';

// Navegação do painel da dona: 3 destinos. Produtos e Fretes ainda não existem (Dia 2 em diante):
// aparecem desligados, com o motivo dito, e não como link quebrado.
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { DESTINOS_ADMIN, destinoAtivo } from '@/lib/loja/rotas';

export function NavegacaoAdmin() {
  const caminho = usePathname();
  return (
    <nav aria-label="Painel" className="sticky bottom-0 z-40 -mx-4 -mb-6 mt-6 border-t border-borda bg-fundo">
      <ul className="mx-auto grid max-w-5xl grid-cols-3">
        {DESTINOS_ADMIN.map((d) => {
          const ativo = destinoAtivo(caminho, d.href);
          const base = 'flex h-(--altura-navegacao) flex-col items-center justify-center px-1 text-center text-sm border-t-4';
          return (
            <li key={d.href}>
              {d.existe ? (
                <Link href={d.href} aria-current={ativo ? 'page' : undefined} className={`${base} ${ativo ? 'border-texto font-bold' : 'border-transparent text-texto-suave'}`}>
                  {d.rotulo}
                </Link>
              ) : (
                <span className={`${base} border-transparent text-texto-suave`}>
                  {d.rotulo}
                  <span className="text-xs">em breve</span>
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
