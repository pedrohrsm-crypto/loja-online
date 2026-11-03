'use client';

import { useActionState } from 'react';
import { autenticador, type EstadoTotp } from './acoes';
import { CampoCodigo } from '@/components/campo-codigo';
import { Aviso } from '@/components/loja/aviso';
import { estiloBotao } from '@/lib/ui/botao';

function Erro({ erro }: { erro: NonNullable<EstadoTotp['erro']> }) {
  if (!erro.texto) return <p role="alert" className="text-erro">{erro.titulo}</p>;
  return <Aviso tipo="erro" titulo={erro.titulo} urgente>{erro.texto}</Aviso>;
}

/** Desafio: a dona já tem o autenticador; digita os 6 números para chegar a `aal2`. */
export function FormularioDesafio({ volta }: { volta?: string }) {
  const [estado, acao, pendente] = useActionState<EstadoTotp, FormData>(autenticador, {});
  return (
    <div className="max-w-sm space-y-4">
      <h1 className="text-3xl font-bold">Código do autenticador</h1>
      <p id="totp-ajuda" className="text-texto-suave">Abra o aplicativo autenticador do seu celular e digite os 6 números do Ateliê Alecrim.</p>
      <form action={acao} className="space-y-4" noValidate>
        {volta ? <input type="hidden" name="volta" value={volta} /> : null}
        <div aria-live="polite">{estado.erro ? <Erro erro={estado.erro} /> : null}</div>
        <CampoCodigo rotulo="Código de 6 números" erro={Boolean(estado.erro)} idDescricao="totp-ajuda" autoFoco />
        <button type="submit" name="intencao" value="desafio" disabled={pendente} className={estiloBotao('primario', 'w-full')}>
          {pendente ? 'Conferindo…' : 'Entrar no painel'}
        </button>
      </form>
    </div>
  );
}

/** Ativação: primeiro o QR (o fator nasce não verificado), depois o código que confirma e entra. */
export function FormularioAtivacao({ volta }: { volta?: string }) {
  const [estado, acao, pendente] = useActionState<EstadoTotp, FormData>(autenticador, {});
  const voltaOculta = volta ? <input type="hidden" name="volta" value={volta} /> : null;
  return (
    <div className="max-w-sm space-y-4">
      <h1 className="text-3xl font-bold">Proteja o painel</h1>
      <p id="ativar-ajuda" className="text-texto-suave">
        Como o painel faz estornos, ele pede um segundo código. Leia o QR com um aplicativo autenticador e digite o código que aparecer.
      </p>
      <div aria-live="polite">{estado.erro ? <Erro erro={estado.erro} /> : null}</div>
      {estado.ativacao ? (
        <form action={acao} className="space-y-4" noValidate>
          {voltaOculta}
          <input type="hidden" name="fator" value={estado.ativacao.fatorId} />
          <div className="mx-auto w-56 max-w-full rounded-md border border-borda bg-qr-fundo p-2">
            {/* O QR vem do Supabase como data URI SVG (mfa.enroll); next/image não otimiza data URI. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={estado.ativacao.qr} alt="QR code do autenticador do Ateliê Alecrim" className="block h-auto w-full" />
          </div>
          <details className="rounded-md border border-borda p-2">
            <summary className="flex min-h-11 cursor-pointer items-center">Não consegue ler o QR? Use a chave</summary>
            <p className="text-sm text-texto-suave">Digite esta chave no aplicativo, no lugar do QR:</p>
            <p className="font-mono break-all">{estado.ativacao.segredo}</p>
          </details>
          <CampoCodigo rotulo="Código de 6 números" erro={Boolean(estado.erro)} idDescricao="ativar-ajuda" />
          <button type="submit" name="intencao" value="ativar" disabled={pendente} className={estiloBotao('primario', 'w-full')}>
            {pendente ? 'Conferindo…' : 'Ativar e entrar'}
          </button>
        </form>
      ) : (
        <form action={acao} noValidate>
          {voltaOculta}
          <button type="submit" name="intencao" value="iniciar" disabled={pendente} className={estiloBotao('primario', 'w-full')}>
            {pendente ? 'Gerando…' : 'Mostrar o QR do autenticador'}
          </button>
        </form>
      )}
    </div>
  );
}
