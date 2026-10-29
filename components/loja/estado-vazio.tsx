import type { ReactNode } from 'react';
import { BarraAcao } from './barra-acao';

// Estado vazio, indisponível ou cancelado: título, texto e a ação principal na barra fixa.
export function EstadoVazio({ titulo, texto, children }: { titulo: string; texto: string; children?: ReactNode }) {
  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-md border border-borda bg-superficie p-4 text-center">
        <h1 className="text-xl font-bold">{titulo}</h1>
        <p className="text-texto-suave">{texto}</p>
      </div>
      {children ? <BarraAcao>{children}</BarraAcao> : null}
    </div>
  );
}
