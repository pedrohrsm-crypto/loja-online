'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ehRotaAdmin } from '@/lib/loja/rotas';
import { Marca } from './marca';

export function Cabecalho() {
  const admin = ehRotaAdmin(usePathname());
  return (
    <header className="border-b border-borda">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-3">
        <Link href={admin ? '/admin/pedidos' : '/'} className="inline-flex min-h-11 items-center">
          <Marca nome={admin ? 'Painel Alecrim' : 'Ateliê Alecrim'} />
        </Link>
        {admin ? (
          <Link href="/" className="inline-flex min-h-11 items-center whitespace-nowrap underline underline-offset-4">
            Ver loja
          </Link>
        ) : null}
      </div>
    </header>
  );
}
