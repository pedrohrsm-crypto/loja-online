@AGENTS.md

# Starter do Framework Aprendido

Repositório inicial para trabalhos freelance (PFA-F, capítulo 15 do framework-aprendido). Um projeto novo começa como cópia deste, e depois instala o kit:

```bash
bash <caminho-do-framework>/kit/instalar.sh <projeto> --freelance
```

O `CLAUDE.md` do kit substitui este no projeto do cliente (o instalador não sobrescreve: apague este antes).

## Regras que o código já garante (e que não se desligam)
- Toda escrita passa por `lib/supabase/escrever.ts` e confere as linhas; nenhum `error` descartado.
- Toda cor vem de token com par em todos os temas (`app/globals.css`); tamanhos em `rem`.
- Toda migration tem `ASSERT` de privilégio e passa na bancada SQL, que reproduz os privilégios padrão do Supabase.
- O webhook de pagamento só responde 2xx depois de gravar, e cada evento é processado uma vez.
- Toda variável de ambiente lida no código está no `.env.example`.

## Portões (rodar separados)
1. `npm run lint` → exit 0 e saída vazia
2. `npm run typecheck`
3. `npm test` (unitários e guardas)
4. `npm run test:sql` (bancada SQL)
5. `npm run e2e` (gera o build e roda a suíte inteira)

Node 22. `npm ci`, nunca `npm install` no CI.
