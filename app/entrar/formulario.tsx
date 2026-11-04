'use client';

import { useActionState, useEffect, useState } from 'react';
import { acessar } from './acoes';
import { ESPERA_REENVIO_S, type EstadoAcesso } from '@/lib/seguranca/acesso';
import { Campo } from '@/components/campo';
import { CampoCodigo } from '@/components/campo-codigo';
import { Aviso } from '@/components/loja/aviso';
import { estiloBotao } from '@/lib/ui/botao';

function Erro({ erro }: { erro: NonNullable<EstadoAcesso['erro']> }) {
  if (!erro.texto) return <p role="alert" className="text-erro">{erro.titulo}</p>;
  return <Aviso tipo="erro" titulo={erro.titulo} urgente>{erro.texto}</Aviso>;
}

function minutos(s: number): string {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// Remontado a cada envio (key = enviadoEm): a espera recomeça do zero.
function Reenviar({ pendente }: { pendente: boolean }) {
  const [inicio] = useState(() => Date.now());
  const [agora, setAgora] = useState(inicio);
  useEffect(() => {
    const id = window.setInterval(() => setAgora(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const restante = Math.max(0, ESPERA_REENVIO_S - Math.floor((agora - inicio) / 1000));
  return (
    <button type="submit" name="intencao" value="reenviar" formNoValidate disabled={pendente || restante > 0} className={estiloBotao('secundario', 'w-full')}>
      {restante > 0 ? `Não chegou? Reenviar em ${minutos(restante)}` : 'Enviar código novo'}
    </button>
  );
}

export function FormularioAcesso({ modo, volta }: { modo: 'entrar' | 'cadastro'; volta?: string }) {
  const [estado, acao, pendente] = useActionState<EstadoAcesso, FormData>(acessar, {});
  const voltaOculta = volta ? <input type="hidden" name="volta" value={volta} /> : null;

  if (estado.etapa === 'codigo') {
    return (
      <div className="max-w-sm space-y-4">
        <h1 className="text-3xl font-bold">Confirme seu e-mail</h1>
        <form action={acao} className="space-y-4" noValidate>
          {voltaOculta}
          <input type="hidden" name="email" value={estado.email ?? ''} />
          {estado.aviso ? <p id="codigo-ajuda" className="text-texto-suave">{estado.aviso}</p> : null}
          <div aria-live="polite">{estado.erro ? <Erro erro={estado.erro} /> : null}</div>
          <CampoCodigo rotulo="Código de 6 números" erro={Boolean(estado.erro)} idDescricao={estado.aviso ? 'codigo-ajuda' : undefined} autoFoco />
          <button type="submit" name="intencao" value="confirmar" disabled={pendente} className={estiloBotao('primario', 'w-full')}>
            {pendente ? 'Enviando…' : 'Confirmar'}
          </button>
          <Reenviar key={estado.enviadoEm ?? 0} pendente={pendente} />
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-sm space-y-4">
      <h1 className="text-3xl font-bold">{modo === 'cadastro' ? 'Criar conta' : 'Entrar'}</h1>
      <p className="text-texto-suave">
        {modo === 'cadastro'
          ? 'Depois de criar a conta, você confirma o e-mail com um código de 6 números, sem sair desta página.'
          : 'Para acompanhar pedidos e finalizar a compra. O seu carrinho continua salvo.'}
      </p>
      <form action={acao} className="space-y-4" noValidate>
        {voltaOculta}
        <Campo nome="email" rotulo="E-mail" tipo="email" valor={estado.email} autoComplete="email" obrigatorio />
        <Campo
          nome="senha"
          rotulo={modo === 'cadastro' ? 'Senha (mínimo 8 caracteres)' : 'Senha'}
          tipo="password"
          autoComplete={modo === 'cadastro' ? 'new-password' : 'current-password'}
          obrigatorio
        />
        <div aria-live="polite" className="min-h-6">
          {estado.erro ? <Erro erro={estado.erro} /> : null}
          {estado.aviso ? <p className="text-sucesso">{estado.aviso}</p> : null}
        </div>
        <button type="submit" name="intencao" value={modo} disabled={pendente} className={estiloBotao('primario', 'w-full')}>
          {pendente ? 'Enviando…' : modo === 'cadastro' ? 'Criar conta' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
