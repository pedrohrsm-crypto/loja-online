import Link from 'next/link';
import { PRODUTOS, formatarReais } from '@/lib/pagamentos/produtos';

export default function Inicio() {
  const produto = PRODUTOS.curso;
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-3xl font-bold">Um produto profissional, pronto em poucos dias</h1>
        <p className="max-w-prose text-texto-suave">
          Página inicial de exemplo. Troque o texto, os produtos em lib/pagamentos/produtos.ts e os papéis em
          lib/seguranca/papeis.ts pelo que a descoberta do trabalho definiu.
        </p>
      </section>
      <section aria-labelledby="titulo-produto" className="max-w-md rounded-lg border border-borda bg-superficie p-6">
        <h2 id="titulo-produto" className="text-xl font-semibold">{produto.nome}</h2>
        <p className="mt-2 text-2xl font-bold">{formatarReais(produto.valorCentavos)}</p>
        <Link href="/conta" className="mt-4 inline-block rounded-md bg-primaria px-4 py-2 font-semibold text-texto-na-primaria">
          Comprar
        </Link>
      </section>
    </div>
  );
}
