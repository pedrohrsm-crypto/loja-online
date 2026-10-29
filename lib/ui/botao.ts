// Estilos de botão e link-botão. Um lugar só: a ação destrutiva (estorno) nunca usa as classes
// do primário de compra, e todo alvo tem 2,75 rem (44 px a 100%) nas duas dimensões.
export type VarianteBotao = 'primario' | 'secundario' | 'perigo' | 'perigo-contorno';

const BASE =
  'inline-flex min-h-11 min-w-11 items-center justify-center rounded-md px-4 py-2 text-center font-semibold disabled:cursor-not-allowed disabled:opacity-60';

export const ESTILOS_BOTAO: Record<VarianteBotao, string> = {
  primario: `${BASE} bg-primaria text-texto-na-primaria`,
  secundario: `${BASE} border-2 border-borda bg-fundo text-texto`,
  perigo: `${BASE} bg-perigo text-texto-no-perigo`,
  'perigo-contorno': `${BASE} border-2 border-perigo bg-fundo text-perigo`,
};

export function estiloBotao(variante: VarianteBotao, extra = ''): string {
  return extra ? `${ESTILOS_BOTAO[variante]} ${extra}` : ESTILOS_BOTAO[variante];
}
