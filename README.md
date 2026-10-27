# starter

Repositório inicial do **Framework Aprendido** para trabalhos freelance: um produto Next.js 16 + Supabase + Stripe que já nasce com os módulos base (Segurança, Acessibilidade, Privacidade, Operação) e o módulo Pagamentos prontos e testados. Método completo no capítulo 15 do `framework-aprendido`.

## O que já vem pronto

| Módulo | No código | Prova |
|---|---|---|
| Segurança | papéis e guarda de área pura (`lib/seguranca/`), proxy que renova a sessão sem laço, RLS com `GRANT` por coluna, funções `SECURITY DEFINER` fechadas para `anon`, cabeçalhos de segurança, chave de serviço isolada | `guarda-area.test.ts`, `redirecionar.test.ts`, bancada SQL (acesso cruzado), guardas do repositório, e2e dos cabeçalhos |
| Acessibilidade | tokens com par em 3 temas e contraste conferido, foco visível, pular para o conteúdo, campos com rótulo e erro anunciado que preservam o digitado | `tokens.test.ts`, axe a 360 px e em 3 temas, 140% de fonte, teclado |
| Privacidade | log sem e-mail, CPF, telefone ou segredo; exclusão de conta que apaga o perfil e mantém a venda sem titular; página de privacidade | `logger.test.ts`, bancada SQL `04_exclusao_de_conta` |
| Operação | CI com todos os portões, commitlint, bancada SQL com Postgres, runbooks | `.github/workflows/ci.yml`, `docs/runbooks/` |
| Pagamentos (único) | checkout com pedido único e chave de idempotência presa ao pedido, webhook assinado e idempotente com reserva recuperável, Pix e boleto pelo evento assíncrono, estorno, reconciliação diária | `webhook.test.ts`, `tratadores.test.ts`, `reconciliar.test.ts`, bancada SQL `02` e `03` |

## Começar um trabalho

```bash
git clone <este repositório> <projeto-do-cliente> && cd <projeto-do-cliente>
rm -rf .git && git init
rm CLAUDE.md && bash <caminho-do-framework>/kit/instalar.sh . --freelance
cp .env.example .env.local   # preencher com as contas DO CLIENTE
npm ci
npm test && npm run test:sql && npm run e2e
```

Depois, o que muda por trabalho:
1. `lib/seguranca/papeis.ts`: papéis e a casa de cada um (da descoberta).
2. `lib/pagamentos/produtos.ts`: produtos e as variáveis de preço.
3. `app/globals.css`: as cores da marca do cliente. A guarda de contraste diz na hora se um par não passa.
4. `supabase/migrations/`: as tabelas do domínio, cada uma com `ASSERT` e um teste de acesso cruzado em `supabase/bancada/testes/`.
5. Aplicar as migrations no projeto Supabase do cliente (`docs/runbooks/migrations.md`).

## Portões
Ver `CLAUDE.md`. No CI, tudo roda em todo PR.

## Limites conhecidos (entram na proposta quando o trabalho pedir)
- **Limite de requisição** nas rotas públicas: configurar no firewall da hospedagem (depende do plano do cliente).
- **Assinatura recorrente**: o módulo cobre pagamento único; assinatura é a variante do módulo, ainda não em código.
- **CSP estrita**: depende dos scripts de terceiros do cliente.
- **E-mail transacional** além do que o Supabase Auth envia: módulo proposto.

## Licença
MIT (`LICENSE`). O código do trabalho entregue é do cliente; este starter continua reutilizável pelo autor em outros trabalhos.
