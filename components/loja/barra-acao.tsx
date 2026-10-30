import type { ReactNode } from 'react';

// Barra fixa da ação principal da tela, logo acima da navegação inferior (o "acao()" do wireframe
// aprovado): a ação principal fica visível sem rolar a 140% de fonte (a 200%, só onde esta barra existe).
export function BarraAcao({ children, testid = 'barra-acao' }: { children: ReactNode; testid?: string }) {
  return (
    <div data-testid={testid} className="sticky bottom-(--altura-navegacao) z-30 -mx-4 flex flex-col gap-2 border-t border-borda bg-fundo px-4 py-3">
      {children}
    </div>
  );
}
