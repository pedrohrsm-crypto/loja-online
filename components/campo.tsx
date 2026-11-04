// Campo de formulário acessível: rótulo ligado, erro anunciado e ligado por aria-describedby,
// valor preservado quando o envio falha (React 19 limpa o formulário depois da action).
type Props = {
  nome: string;
  rotulo: string;
  tipo?: 'text' | 'email' | 'password' | 'tel';
  modoTeclado?: 'text' | 'numeric' | 'tel';
  ajuda?: string;
  valor?: string;
  erro?: string;
  autoComplete?: string;
  obrigatorio?: boolean;
};

export function Campo({ nome, rotulo, tipo = 'text', modoTeclado, ajuda, valor, erro, autoComplete, obrigatorio }: Props) {
  const idErro = erro ? `${nome}-erro` : undefined;
  const idAjuda = ajuda ? `${nome}-ajuda` : undefined;
  return (
    <div className="space-y-1">
      <label htmlFor={nome} className="block font-medium">{rotulo}</label>
      <input
        id={nome}
        name={nome}
        type={tipo}
        defaultValue={valor}
        autoComplete={autoComplete}
        required={obrigatorio}
        aria-invalid={erro ? true : undefined}
        inputMode={modoTeclado}
        aria-describedby={[idAjuda, idErro].filter(Boolean).join(' ') || undefined}
        className="min-h-11 w-full rounded-md border border-borda bg-fundo px-3 py-2 text-texto"
      />
      {ajuda ? <p id={idAjuda} className="text-sm text-texto-suave">{ajuda}</p> : null}
      {erro ? <p id={idErro} className="text-sm text-erro">{erro}</p> : null}
    </div>
  );
}
