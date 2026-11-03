// Campo do código de 6 números (e-mail e autenticador). Um campo só, não seis caixas: o leitor de
// tela lê um rótulo, o celular oferece o código recebido (one-time-code) e colar "123 456" funciona.
// Tamanho em rem e largura em ch: os 6 números cabem inteiros a 140% de fonte em 360 px (M-UX, tela 9).
type Props = { nome?: string; rotulo: string; erro?: boolean; idDescricao?: string; autoFoco?: boolean };

export function CampoCodigo({ nome = 'codigo', rotulo, erro, idDescricao, autoFoco }: Props) {
  return (
    <div className="space-y-1">
      <label htmlFor={nome} className="block font-medium">{rotulo}</label>
      <input
        id={nome}
        name={nome}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9 ]*"
        maxLength={7}
        required
        autoFocus={autoFoco}
        aria-invalid={erro ? true : undefined}
        aria-describedby={idDescricao}
        className="block min-h-11 w-full max-w-[13ch] rounded-md border-2 border-borda bg-fundo px-3 py-2 text-center font-mono text-2xl tracking-[0.3em] text-texto"
      />
    </div>
  );
}
