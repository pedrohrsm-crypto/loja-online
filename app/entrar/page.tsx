import type { Metadata } from 'next';
import Link from 'next/link';
import { FormularioAcesso } from './formulario';

export const metadata: Metadata = { title: 'Entrar' };

export default async function Entrar({ searchParams }: PageProps<'/entrar'>) {
  const modo = (await searchParams).modo === 'cadastro' ? 'cadastro' : 'entrar';
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{modo === 'cadastro' ? 'Criar conta' : 'Entrar'}</h1>
      <FormularioAcesso modo={modo} />
      <p>
        {modo === 'cadastro' ? (
          <Link href="/entrar" className="underline">Já tenho conta</Link>
        ) : (
          <Link href="/entrar?modo=cadastro" className="underline">Criar uma conta</Link>
        )}
      </p>
    </div>
  );
}
