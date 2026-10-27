'use client';

import { useActionState } from 'react';
import { comprar, excluirConta, salvarNome, type Estado } from './acoes';
import { Campo } from '@/components/campo';

function Mensagem({ estado }: { estado: Estado }) {
  return (
    <div aria-live="polite" className="min-h-6">
      {estado.erro ? <p role="alert" className="text-erro">{estado.erro}</p> : null}
      {estado.ok ? <p className="text-sucesso">{estado.ok}</p> : null}
    </div>
  );
}

const BOTAO = 'rounded-md bg-primaria px-4 py-2 font-semibold text-texto-na-primaria disabled:opacity-70';

export function FormularioCompra({ produto, rotulo }: { produto: string; rotulo: string }) {
  const [estado, acao, pendente] = useActionState<Estado, FormData>(comprar, {});
  return (
    <form action={acao} className="space-y-2">
      <input type="hidden" name="produto" value={produto} />
      <button type="submit" disabled={pendente} className={BOTAO}>{pendente ? 'Abrindo o pagamento…' : rotulo}</button>
      <Mensagem estado={estado} />
    </form>
  );
}

export function FormularioNome({ nome }: { nome: string }) {
  const [estado, acao, pendente] = useActionState<Estado, FormData>(salvarNome, { nome });
  return (
    <form action={acao} className="max-w-sm space-y-3">
      <Campo nome="nome" rotulo="Nome" valor={estado.nome} autoComplete="name" />
      <button type="submit" disabled={pendente} className={BOTAO}>{pendente ? 'Salvando…' : 'Salvar nome'}</button>
      <Mensagem estado={estado} />
    </form>
  );
}

export function FormularioExclusao() {
  const [estado, acao, pendente] = useActionState<Estado, FormData>(excluirConta, {});
  return (
    <form action={acao} className="max-w-sm space-y-3">
      <Campo nome="confirmacao" rotulo="Para excluir a conta, digite EXCLUIR" erro={estado.erro} />
      <button type="submit" disabled={pendente} className="rounded-md border border-erro px-4 py-2 font-semibold text-erro disabled:opacity-70">
        {pendente ? 'Excluindo…' : 'Excluir minha conta'}
      </button>
    </form>
  );
}
