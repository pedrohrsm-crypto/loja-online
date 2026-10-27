// Campo de formulário acessível: rótulo ligado, erro anunciado e ligado por aria-describedby,
// valor preservado quando o envio falha (React 19 limpa o formulário depois da action).
type Props = {
  nome: string;
  rotulo: string;
  tipo?: 'text' | 'email' | 'password';
  valor?: string;
  erro?: string;
  autoComplete?: string;
  obrigatorio?: boolean;
};

export function Campo({ nome, rotulo, tipo = 'text', valor, erro, autoComplete, obrigatorio }: Props) {
  const idErro = erro ? `${nome}-erro` : undefined;
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
        aria-describedby={idErro}
        className="w-full rounded-md border border-borda bg-fundo px-3 py-2 text-texto"
      />
      {erro ? <p id={idErro} className="text-sm text-erro">{erro}</p> : null}
    </div>
  );
}
