# Runbook — virada do pagamento de teste para produção

Configurações do processador **não migram** de teste para produção (04, erro 3.6). Faça tudo de novo no modo produção:

1. **Conta verificada** do cliente no Stripe, com a empresa e os dados bancários dele.
2. **Produtos e preços** recriados em produção; os ids novos em `STRIPE_PRECO_*` na hospedagem.
3. **Chaves:** `STRIPE_SECRET_KEY` de produção (restrita, só com o que o código usa). Nenhum id de customer de teste reaproveitado (04, 3.4).
4. **Endpoint do webhook** de produção apontando para `/api/pagamentos/webhook`, com os eventos: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded`. O segredo novo em `STRIPE_WEBHOOK_SECRET`.
5. **Meios de pagamento** (`PAGAMENTO_METODOS`): só o que a conta de produção do cliente aceita.
6. **Compra real de valor baixo**, com estorno em seguida: o pedido vai a pago e depois a estornado.
7. **Reconciliação:** `CRON_SECRET` definido; a primeira execução do cron aparece no log `pagamentos.reconciliar`.
