// Faixa curta que declara que a tela usa dados de exemplo (lib/loja/exemplos.ts). Curta de propósito:
// a ação principal da tela precisa continuar visível sem rolar a 140% de fonte.
export function NotaExemplo({ texto, rotulo = 'Demonstração.' }: { texto: string; rotulo?: string }) {
  return (
    <p className="rounded-md border border-borda bg-superficie px-3 py-2 text-sm text-texto-suave">
      <strong className="text-texto">{rotulo}</strong> {texto}
    </p>
  );
}
