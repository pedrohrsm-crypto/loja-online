# Runbook — rotação de segredos

Quando: na passagem ao cliente, ao sair alguém com acesso, ou a qualquer suspeita de vazamento.

| Segredo | Onde gerar | Onde trocar | Como conferir |
|---|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → API → rotacionar | Hospedagem | Painel admin abre |
| `STRIPE_SECRET_KEY` | Stripe → Desenvolvedores → Chaves | Hospedagem | Uma compra de teste abre o checkout |
| `STRIPE_WEBHOOK_SECRET` | Stripe → endpoint → revelar/rotacionar | Hospedagem | Reenviar um evento: 200 (a rota aceita as duas assinaturas durante a rotação) |
| `CRON_SECRET` | `openssl rand -hex 32` | Hospedagem | Próxima execução do cron sem 401 |

Depois de trocar: novo deploy, e o segredo antigo revogado na origem.
