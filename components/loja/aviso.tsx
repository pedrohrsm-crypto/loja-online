// Aviso com título e texto. A cor sozinha não carrega o sentido: o título diz o que é.
import type { ReactNode } from 'react';

type Tipo = 'erro' | 'atencao' | 'info';

const BORDA: Record<Tipo, string> = {
  erro: 'border-l-erro',
  atencao: 'border-l-atencao',
  info: 'border-l-borda',
};

const TITULO: Record<Tipo, string> = {
  erro: 'text-erro',
  atencao: 'text-atencao',
  info: 'text-texto',
};

export function Aviso({ tipo = 'info', titulo, children, urgente = false, id }: { tipo?: Tipo; titulo: string; children?: ReactNode; urgente?: boolean; id?: string }) {
  return (
    <div id={id} role={urgente ? 'alert' : 'status'} className={`space-y-1 rounded-md border border-borda border-l-4 bg-superficie p-3 ${BORDA[tipo]}`}>
      <p className={`font-semibold ${TITULO[tipo]}`}>{titulo}</p>
      {children ? <div className="text-sm text-texto-suave">{children}</div> : null}
    </div>
  );
}
