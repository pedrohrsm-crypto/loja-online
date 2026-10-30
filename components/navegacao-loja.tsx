'use client';

// Barra inferior da loja: os mesmos destinos no celular e no computador. Some no painel da dona.
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { contarUnidades } from '@/lib/loja/carrinho';
import { useCarrinho } from '@/lib/loja/carrinho-armazenamento';
import { DESTINOS_LOJA, destinoAtivo, ehRotaAdmin } from '@/lib/loja/rotas';

export function NavegacaoLoja() {
  const caminho = usePathname();
  const carrinho = useCarrinho();
  if (ehRotaAdmin(caminho)) return null;
  const unidades = carrinho ? contarUnidades(carrinho.itens) : 0;
  const destinos = DESTINOS_LOJA.filter((d) => d.existe);
  return (
    <nav aria-label="Principal" className="sticky bottom-0 z-40 border-t border-borda bg-fundo">
      <ul className="mx-auto grid max-w-5xl" style={{ gridTemplateColumns: `repeat(${destinos.length}, minmax(0, 1fr))` }}>
        {destinos.map((d) => {
          const ativo = destinoAtivo(caminho, d.href);
          return (
            <li key={d.href}>
              <Link
                href={d.href}
                aria-current={ativo ? 'page' : undefined}
                className={`flex h-(--altura-navegacao) items-center justify-center px-1 text-center text-sm ${ativo ? 'border-t-4 border-texto font-bold' : 'border-t-4 border-transparent text-texto-suave'}`}
              >
                {d.rotulo}
                {d.href === '/carrinho' && unidades > 0 ? (
                  <>
                    <span aria-hidden="true">&nbsp;({unidades})</span>
                    <span className="sr-only">, {unidades} {unidades === 1 ? 'item' : 'itens'}</span>
                  </>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
