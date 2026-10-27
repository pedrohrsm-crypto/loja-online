'use client';

import { useActionState } from 'react';
import { acessar, type EstadoAcesso } from './acoes';
import { Campo } from '@/components/campo';

export function FormularioAcesso({ modo }: { modo: 'entrar' | 'cadastro' }) {
  const [estado, acao, pendente] = useActionState<EstadoAcesso, FormData>(acessar, {});
  return (
    <form action={acao} className="max-w-sm space-y-4" noValidate>
      <input type="hidden" name="modo" value={modo} />
      <Campo nome="email" rotulo="E-mail" tipo="email" valor={estado.email} autoComplete="email" obrigatorio />
      <Campo nome="senha" rotulo="Senha" tipo="password" autoComplete={modo === 'cadastro' ? 'new-password' : 'current-password'} obrigatorio />
      <div aria-live="polite" className="min-h-6">
        {estado.erro ? <p role="alert" className="text-erro">{estado.erro}</p> : null}
        {estado.aviso ? <p className="text-sucesso">{estado.aviso}</p> : null}
      </div>
      <button type="submit" disabled={pendente} className="rounded-md bg-primaria px-4 py-2 font-semibold text-texto-na-primaria disabled:opacity-70">
        {pendente ? 'Enviando…' : modo === 'cadastro' ? 'Criar conta' : 'Entrar'}
      </button>
    </form>
  );
}
