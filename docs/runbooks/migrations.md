# Runbook — aplicar migration

1. A migration está em `supabase/migrations/` e passou na bancada (`npm run test:sql`), com os `ASSERT` de privilégio.
2. Aplique pelo CLI do Supabase (`supabase db push`) ou cole no SQL Editor **o arquivo inteiro de uma vez** (rodado em partes, o SQL Editor faz autocommit: 04, erro 1.10).
3. Confira que rodou: `select to_regclass('public.<tabela nova>');` não volta nulo (04, erro 1.2).
4. Só então publique o código que usa o schema novo (`deploy.md`).
