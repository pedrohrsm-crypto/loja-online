// Leitura de variável de ambiente obrigatória: falha alto e cedo, com o nome da variável.
// Toda variável lida aqui precisa estar no .env.example (a guarda em lib/guardas.test.ts confere).
export function ambiente(nome: string): string {
  const v = process.env[nome];
  if (!v) throw new Error(`variável de ambiente ausente: ${nome} (ver .env.example)`);
  return v;
}
