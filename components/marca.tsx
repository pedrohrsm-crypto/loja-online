// Wordmark do Ateliê Alecrim: raminho de alecrim em SVG inline + nome na fonte de títulos.
// A cor vem de currentColor (o pai põe o token): muda com o tema sem um hex aqui. O conjunto é uma
// imagem só (role=img no conjunto), com o nome como rótulo: o leitor de tela fala "Ateliê Alecrim" uma vez.
// O raminho sozinho tem aria-label e <title> próprios, para uso fora da Marca.
const FOLHAS: Array<{ x: number; y: number }> = [
  { x: 8.5, y: 24 },
  { x: 11.5, y: 19.5 },
  { x: 15, y: 15 },
  { x: 19, y: 10.5 },
  { x: 22.5, y: 6.5 },
];

export function Raminho({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" role="img" aria-label="Raminho de alecrim" focusable="false" className={className} fill="currentColor">
      <title>Raminho de alecrim</title>
      <path d="M6 29C10 20 16 12 25 3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      {FOLHAS.map(({ x, y }) => (
        <g key={`${x}-${y}`}>
          <ellipse cx={x + 3.5} cy={y - 0.8} rx="1.1" ry="3.6" transform={`rotate(77 ${x + 3.5} ${y - 0.8})`} />
          <ellipse cx={x - 0.2} cy={y - 3.6} rx="1.1" ry="3.6" transform={`rotate(-3 ${x - 0.2} ${y - 3.6})`} />
        </g>
      ))}
      <ellipse cx="25.6" cy="1.8" rx="1" ry="2.4" transform="rotate(37 25.6 1.8)" />
    </svg>
  );
}

export function Marca({ nome = 'Ateliê Alecrim' }: { nome?: string }) {
  return (
    <span role="img" aria-label={nome} className="inline-flex items-center gap-2 text-primaria">
      <Raminho className="size-7 shrink-0" />
      <span aria-hidden="true" className="font-[family-name:var(--font-titulo)] text-xl font-bold leading-none">
        {nome}
      </span>
    </span>
  );
}
