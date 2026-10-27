# Runbook — publicar uma versão

1. PR verde (todos os portões do CI) e integrado na `main`.
2. **Migration nova?** Aplique ANTES do deploy (`migrations.md`). O código precisa tolerar o schema antigo durante a janela (`lib/supabase/coluna-ausente.ts`).
3. A hospedagem publica a `main` sozinha. Confira no painel que o deploy terminou e abra a página inicial e a de entrar.
4. Evento novo do processador de pagamento tratado neste deploy? Marque-o no endpoint de produção (`pagamento-producao.md`, passo 4).
5. Deu errado: reverta pelo painel da hospedagem para o deploy anterior (1 clique). Migration não se reverte: corrige-se para a frente.
