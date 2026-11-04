import type { Metadata } from 'next';
import Link from 'next/link';
import { FormularioAcesso } from './formulario';
import { comVolta, destinoSeguro } from '@/lib/seguranca/destino';

export const metadata: Metadata = { title: 'Entrar', robots: { index: false } };

export default async function Entrar({ searchParams }: PageProps<'/entrar'>) {
  const busca = await searchParams;
  const modo = busca.modo === 'cadastro' ? 'cadastro' : 'entrar';
  // A volta só segue adiante se for caminho do próprio site (S-07); a Server Action confere de novo.
  const volta = destinoSeguro(busca.volta) ?? undefined;
  const outro = comVolta('/entrar', volta);
  const separador = outro.includes('?') ? '&' : '?';
  return (
    <div className="space-y-6">
      {/* key: trocar entre Entrar e Criar conta começa um formulário novo */}
      <FormularioAcesso key={modo} modo={modo} volta={volta} />
      <p>
        {modo === 'cadastro' ? (
          <Link href={outro} className="inline-flex min-h-11 items-center underline underline-offset-4">Já tenho conta</Link>
        ) : (
          <Link href={`${outro}${separador}modo=cadastro`} className="inline-flex min-h-11 items-center underline underline-offset-4">Criar uma conta</Link>
        )}
      </p>
    </div>
  );
}
