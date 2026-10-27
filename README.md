# loja-online

Loja online de **cosméticos artesanais** para um cliente **fictício** (Ateliê Alecrim): catálogo com variações, carrinho, checkout com Pix e cartão pelo **Mercado Pago**, conta do comprador e painel de administração para pedidos e estoque.

É um MVP de portfólio feito pelo ciclo **PFA-F** do Framework Aprendido (entrega freelance: descoberta → proposta → Dia 0 → construção → endurecimento → aceite). Nenhum dado real de pessoa ou empresa; pagamentos só em modo de teste.

> **Estado em 27-Out-2026: Dia 0.** O código ainda é o do starter (Next.js + Supabase, com o módulo de pagamento em Stripe). As telas da loja e a troca para o Mercado Pago entram depois da aprovação dos wireframes (`docs/freelance/FIDELIDADE.md` §2).

## Documentos do trabalho
| Etapa | Documento |
|---|---|
| Descoberta (F0) | [`docs/freelance/DESCOBERTA.md`](docs/freelance/DESCOBERTA.md) — cliente fictício, as 15 perguntas, as 9 áreas, tipo "Loja" |
| Prospecto do usuário final (F0b) | [`docs/freelance/PROSPECTO.md`](docs/freelance/PROSPECTO.md) |
| Proposta (F1) | [`docs/freelance/PROPOSTA.md`](docs/freelance/PROPOSTA.md) — escopo, estimativa, cronograma, comparação com plataforma pronta |
| Baixa fidelidade | [`docs/freelance/FIDELIDADE.md`](docs/freelance/FIDELIDADE.md) §1 — jornadas, mapa de 14 telas, mapa de acesso |
| Riscos do Mercado Pago | [`docs/freelance/RISCOS_MERCADO_PAGO.md`](docs/freelance/RISCOS_MERCADO_PAGO.md) — o que muda em relação ao Stripe e o ciclo de 22 testes |
| Dia 0 | [`docs/DIA_ZERO.md`](docs/DIA_ZERO.md) — checklist e fornecedores com preço, cota e política conferidos |
| Aceite (F2/F3) | [`docs/freelance/ACEITE.md`](docs/freelance/ACEITE.md) — a barra de qualidade, com evidência |

## Stack
Next.js 16 · Supabase (Postgres, Auth) · Mercado Pago (Orders API) · Vercel · Tailwind com tokens · Vitest · Playwright com axe. Node 24 (`.nvmrc`).

## Como rodar
```bash
npm ci
cp .env.example .env.local   # preencher com as contas de TESTE (nunca commitar)
npm run dev
```

## Portões (rodar separados; o CI roda todos em todo PR)
```bash
npm run lint        # exit 0 e saída vazia
npm run typecheck
npm test            # unitários e guardas
npm run test:sql    # bancada SQL: migrations com ASSERT de privilégio e acesso cruzado
npm run e2e         # gera o build e roda a suíte inteira (360 px, desktop, tema escuro, axe)
```

## Licença
MIT (`LICENSE`).
