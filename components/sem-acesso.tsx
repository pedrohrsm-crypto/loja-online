// A guarda de área não redireciona na dúvida: explica (lib/seguranca/guarda-area.ts, regra 2).
export function SemAcesso({ causa }: { causa: 'erro-ao-ler-perfil' | 'sem-papel' }) {
  return (
    <div role="alert" className="max-w-prose space-y-2">
      <h1 className="text-2xl font-bold">Não foi possível abrir esta área</h1>
      <p>
        {causa === 'erro-ao-ler-perfil'
          ? 'Não conseguimos carregar a sua conta agora. Recarregue a página em alguns instantes.'
          : 'A sua conta não tem acesso a esta área.'}
      </p>
    </div>
  );
}
