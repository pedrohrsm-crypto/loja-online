# Riscos do inédito: Pagamentos com Mercado Pago — loja-online — 2026-10-26

O módulo `kit/freelance/modulos/pagamentos.md` e o código do `starter` (branch `starter-provisorio`, `e94c649`: `lib/pagamentos/*`, migration `20260929000002_pagamentos.sql`) foram escritos para o **Stripe Checkout**. Este levantamento compara, peça por peça, o que o starter faz e o que muda com o Mercado Pago. O resultado vira **a parte inédita da estimativa** (`PROPOSTA.md` §3) e **o roteiro do ciclo de teste** (§3 abaixo).

**Fontes conferidas em 26-Out-2026** (documentação oficial do Mercado Pago, lida nesta sessão):
- Webhooks: <https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks> e a versão em espanhol, com o modelo do manifest da assinatura.
- Pix pela Orders API: <https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/payment-integration/websites/pix>
- Teste de Pix: <https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/integration-test/pix>
- Estornos e cancelamentos (Orders): páginas `checkout-api-orders/refunds-cancellations` e `checkout-pro-orders/refunds-cancellations`, lidas pelo resumo da busca e não abertas inteiras → `[parcial]`.
- **Taxas, em 26-Out (painel do Mercado Pago; a página pública de tarifas respondeu 403):** Pix **0,0%** e cartão de crédito à vista **4,98%**, lidos no painel do Mercado Pago em 26-Out-2026 (numa conta PJ de cliente real podem diferir). **Ainda não conferidos:** o prazo de recebimento associado aos 4,98%, as taxas do parcelamento e o prazo máximo de estorno. Ficam para o Dia 0, antes de construir.

---

## 0. Decisão de integração que vem antes (D-LO-5, decidida em 26-Out)
O Mercado Pago oferece hoje dois caminhos para loja própria. A documentação marca o Checkout Transparente pela Payments API como **"legado"** e empurra a **Orders API** (`POST /v1/orders`). Isso é novidade em relação ao que se costuma ler.

| Caminho | Como é | Prós | Contras |
|---|---|---|---|
| **Checkout Pro (Orders)** | Redireciona para a página do Mercado Pago (Pix e cartão lá) e volta | O análogo direto do Stripe Checkout do starter (sessão hospedada); dado do cartão nunca toca a loja (escopo PCI mínimo); menos código inédito | O comprador sai da loja; menos controle da tela do Pix |
| **Checkout Transparente (Orders API + Card Payment Brick)** | Pix com QR na própria loja; cartão tokenizado no navegador pelo SDK JS | A tela do Pix com contagem regressiva fica na loja (prospecto I-06); vitrine técnica melhor para o portfólio | Mais inédito: tokenização, mais estados (`action_required`, processamento assíncrono) e mais telas de erro |

**Recomendação:** **Checkout Transparente via Orders API** para o **Pix** (o QR e a expiração na loja são o coração do P-01 do prospecto) e o **Card Payment Brick** para o cartão, tudo na mesma Orders API. É mais inédito, mas é o que a loja ensina ao framework e o que o portfólio quer mostrar. **Plano B, se o inédito estourar o teto:** Checkout Pro para os dois meios (corta cerca de 1 sessão de construção e 0,5 h do dono). **Decidida pelo Pedro no aceite de 26-Out-2026: Checkout Transparente, como recomendado.**

---

## 1. O que muda, peça por peça
| Tema | No starter (Stripe) | No Mercado Pago (conferido em 26-Out) | O que fazer (vira item do inédito) | Risco |
|---|---|---|---|---|
| **Pix com QR e expiração** | Stripe Checkout hospedado; Pix como `payment_method_types` | `POST /v1/orders` com `payment_method.id = pix`, `type = bank_transfer`; a resposta traz `qr_code` (copia e cola), `qr_code_base64` e `ticket_url`; o pagamento fica `action_required` / `waiting_transfer` até pagar. **Expiração** `expiration_time` em duração ISO 8601: **padrão 24 h, mínimo 30 min, máximo 30 dias**. Exige **chave Pix cadastrada** na conta | Expiração de **30 min** (`PT30M`); a **reserva de estoque** dura a mesma janela mais uma folga; a tela do Pix consulta o estado real (não a URL) | **Alto.** Pagamento que chega **depois** de o pedido local expirar (R3): o Pix foi pago no último segundo e a reconciliação já devolveu o estoque. Regra: aprovado depois de expirar → se há estoque, confirma; se não há, estorno automático + e-mail + alerta à dona |
| **Webhook e assinatura** | `verificarAssinatura(corpo bruto, cabeçalho, segredo)`, o esquema do Stripe sobre o **corpo** | Cabeçalho `x-signature: ts=…,v1=…`; HMAC-SHA256 **em hexadecimal**, com a assinatura secreta da aplicação, sobre o **manifest** `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`. O `data.id` vem da **query string** (minúsculo, se for alfanumérico, como os IDs `ORD…` das orders); remove do modelo o campo que não vier. **O corpo não é assinado** | Reescrever `assinatura.ts`: manifest, comparação em tempo constante e tolerância de `ts` (ex.: 5 min). **Nunca confiar no corpo:** com o `data.id`, buscar `GET /v1/orders/{id}` (ou `/v1/payments/{id}`) e decidir pelo que a API devolve | **Alto.** Como o corpo não é assinado, um tratador que lê `status` do corpo aceita notificação forjada com ID real. Guarda: teste que manda corpo com `status=approved` adulterado e confere que nada muda |
| **Prazo e reentrega** | Stripe retenta por até 3 dias, com recuo | Resposta **200/201 em até 22 s**; sem confirmação, nova tentativa **a cada 15 min**, e depois da 3ª o intervalo aumenta (total não informado) | O tratador faz 1 `GET` com tempo máximo de 8 s; falha transitória → devolve a reserva e responde 500 (padrão do starter, 04 3.1). A reconciliação de 15 min cobre o resto | Médio. 22 s com `GET` mais gravação mais e-mail: o **e-mail sai fora do caminho do webhook** (fila ou rotina), para não estourar o prazo |
| **Idempotência** | (a) `Idempotency-Key` do checkout derivada do pedido (`chave.ts`); (b) evento reservado por `event.id` (`reservar_evento_pagamento`) | (a) **`X-Idempotency-Key` obrigatório** no `POST /v1/orders`. (b) A notificação tem `id` próprio, mas o **mesmo pagamento gera várias notificações** (`action` diferente: criado, atualizado) | (a) Reaproveitar `chaveDoCheckout(pedidoId, corpo)`. (b) Reservar por id da notificação **e** tornar o **efeito** idempotente: transição de estado monotônica (`aberto → pago → estornado`), e a baixa de estoque só na transição para `pago`, com `UPDATE … WHERE status = 'aberto'` conferindo 1 linha | **Alto.** Duas notificações diferentes do mesmo pagamento aprovado baixam o estoque duas vezes se a idempotência for só por evento. Guarda: teste com 2 notificações distintas do mesmo pagamento |
| **Estorno** | `charge.refunded` pelo `payment_intent`; estorno feito no painel do Stripe | Estorno total pelo `POST /v1/orders/{id}/refund` com corpo vazio; parcial com valor e ID da transação; cancelamento só em `created` / `action_required` `[parcial]`. **Chargeback** é outro tópico (`topic_chargebacks_wh`, com consulta em `/v1/chargebacks/{id}`). **Prazo máximo de estorno: não conferido** | Estorno **total** pelo painel da loja (botão da dona, com confirmação dupla, prospecto I-10), com `X-Idempotency-Key` derivada de `estorno-<pedido>`; estado `estornado` só quando a API confirma (webhook ou `GET`); **chargeback** vira alerta por e-mail à dona e estado `contestado`. Estorno **parcial fica fora do MVP** | Médio. Estorno de Pix devolve à conta do pagador; o texto para a cliente sobre o prazo depende de conferir no Dia 0 |
| **Reconciliação** | `reconciliar.ts` diário: confere pedidos abertos contra a **sessão** do Stripe | Consultar a order pelo ID guardado (`GET /v1/orders/{id}`) ou buscar pagamentos por `external_reference` = id do pedido | Duas cadências: **a cada 15 min** para pedidos Pix abertos (expira reserva, recupera aprovado perdido) e **diária** para o resto (pagos sem e-mail, estornos e chargebacks não refletidos). Trava contra execução sobreposta (14 §2 BKD). Alerta quando a rotina falha 2 vezes seguidas | Médio. Cron de 15 min na Vercel Hobby `[não conferido: limite de frequência do plano]` → plano B: GitHub Actions agendado chamando a rota com segredo |
| **Sandbox e modo** | `modoDaChave`: `sk_test_` → teste; customer de teste nunca reaproveitado (04 3.4) | Credenciais de teste também começam com `APP_USR` (o prefixo não distingue o modo como no Stripe); a notificação traz `live_mode`; **Pix de teste não se paga lendo o QR**: a aprovação é simulada criando a order com `payer.first_name = "APRO"`; cartões de teste por nome do titular (`APRO`, `OTHE`…) `[os nomes além de APRO não conferidos]`; contas de teste comprador/vendedor | `modo` do pedido vem de uma variável `PAGAMENTO_MODO` explícita, **não do prefixo**; o webhook recusa (200 + aviso) notificação com `live_mode` diferente do modo do pedido; o e2e usa `APRO` / `OTHE` | **Alto para a virada** (cliente real): sem prefixo distinto, é fácil subir produção com a credencial de teste ou o contrário. Guarda: verificação de inicialização + `live_mode` × `modo` |
| **Processamento assíncrono** | Sessão criada é síncrona | Criar a order pode ficar "processando" sem dados até atualizar | A tela de pagamento trata o estado "processando" (carregando com tempo máximo e nova consulta) | Baixo |
| **Taxas e recebimento** | Conferidas no Stripe em outro projeto | Pix **0,0%** e cartão de crédito à vista **4,98%**, lidos no painel do Mercado Pago em 26-Out-2026 (numa conta PJ de cliente real podem diferir). Prazo de recebimento, parcelamento e prazo de estorno **não conferidos** | Registrar no `DIA_ZERO.md` (tabela de fornecedores); o resumo do mês (I-11, opcional) usa estes valores | Baixo. O Pix sem taxa favorece oferecer o Pix em destaque no checkout |
| **Valor em reais** | `valor_centavos` inteiro; `price` do Stripe | `total_amount` é **string decimal** ("85.00") | Uma função só `centavosParaMP(85_00) → "85.00"`, com teste de arredondamento; o total sempre recalculado no servidor a partir de `variacoes.preco_centavos` + frete | Médio. Erro de vírgula ou ponto, ou de float, cobra errado (04 cat. 3) |

## 2. O que continua igual (reuso do starter)
Pedido aberto único por carrinho (índice parcial), reserva de evento recuperável (`reservar_evento_pagamento`), resposta 500 em falha transitória e 200 em dado inválido, escrita conferida (`escrever`), RLS de `pedidos` só leitura do dono, exclusão de conta com `on delete set null`, e o runbook `pagamento-producao.md`, que precisa ser reescrito para o Mercado Pago mas mantém a mesma estrutura.

## 3. Ciclo de teste (vira a linha "Pagamentos" do `ACEITE.md` e os e2e do Dia 4)
Todos em sandbox, com evidência (log do teste, captura e linha no `ACEITE.md`):

| # | Caso | Como provocar | Esperado |
|---|---|---|---|
| T1 | Compra com cartão aprovada | Card Brick com titular `APRO` | Pedido `pago`, estoque baixado 1 vez, e-mail "pago" ao comprador e aviso à dona |
| T2 | Cartão recusado | Titular `OTHE` (ou outro nome de recusa conferido no Dia 0) | Pedido continua `aberto` (ou `recusado`), estoque **reservado** até expirar; mensagem clara "cartão recusado, tente outro meio" |
| T3 | Pix aprovado | Order com `payer.first_name = APRO` | QR exibido; a tela vira "pago" sozinha; estoque baixado 1 vez |
| T4 | Pix expirado | Order Pix sem pagamento; aguardar 30 min (ou rotina com relógio injetado) | Pedido `cancelado`, reserva devolvida, e-mail "pedido expirou" opcional |
| T5 | Pix pago depois de expirar (R3) | Simular aprovação com o pedido local já cancelado | Com estoque: pedido reativado e `pago`. Sem estoque: estorno automático, e-mail e alerta à dona |
| T6 | Estorno total | Botão da dona com confirmação dupla | Pedido `estornado` só depois da confirmação da API; e-mail ao comprador; estoque devolvido só se marcado "não enviado" |
| T7 | Recompra depois do estorno | O mesmo comprador compra o mesmo item | Funciona (nenhuma restrição única impede; 04 3.5) |
| T8 | Webhook repetido | Reenviar a mesma notificação 2 vezes | 2ª → 200 `duplicado`; nada muda |
| T9 | Duas notificações do mesmo pagamento | Notificações distintas (`created` e `updated`) do mesmo aprovado | Estoque baixado **1** vez (transição monotônica) |
| T10 | Assinatura inválida, adulterada ou velha | `v1` errado; corpo com `status=approved` forjado; `ts` fora da tolerância | 400 nos dois primeiros e no velho; o corpo forjado nunca muda estado (decisão pelo `GET`) |
| T10b | Aprovado com valor diferente do pedido (S-05) | Order aprovada com `total_amount` ≠ `pedidos.total_centavos`, ou ligada a outro pedido | Nada vira `pago`; alerta à dona; pedido ligado só pelo `mp_order_id` gravado na criação |
| T11 | Banco fora no webhook | Falha injetada na gravação | 500, reserva devolvida, o Mercado Pago retenta; depois processa uma vez |
| T12 | Duas abas, mesmo carrinho | Duas finalizações simultâneas | Um pedido, uma cobrança (índice parcial + `X-Idempotency-Key` do pedido) |
| T13 | Último item disputado (R2) | Dois compradores, estoque 1, checkouts simultâneos | Um reserva; o outro recebe "acabou de esgotar" antes de pagar |
| T14 | Reconciliação recupera | Apagar à mão a gravação de um pagamento aprovado de teste | A rotina de 15 min marca `pago` e baixa o estoque 1 vez |
| T15 | Chargeback | Notificação `topic_chargebacks_wh` simulada | Pedido `contestado`, alerta por e-mail à dona |
| T16 | Modo trocado | Notificação com `live_mode=true` num pedido de teste | 200 + aviso no log; nada muda |
| T17 | Valor | Item de R$ 85,00 × 3 + frete R$ 25,00 | `total_amount = "280.00"`; o adulterado no cliente é ignorado (o servidor recalcula) |
| T17b | Quantidade inválida (S-04) | Quantidade -1, 0 ou acima do teto | Recusado no servidor; nenhum pedido criado |
| T17c | Variação despublicada (S-04) | Comprar uma variação em rascunho pelo id | Recusado; carrinho com o item marcado |
| T17d | Região de outro CEP (S-04) | Mandar o id da região mais barata com CEP de outra região | O frete vem do CEP gravado; o id do formulário é ignorado |
| T18 | Carrinho alterado depois da cobrança (S-05) | Criar o Pix de R$ 85, aumentar o carrinho e pagar o primeiro Pix | Confirma só o pedido congelado de R$ 85; o carrinho novo vira outro pedido |

## 4. O que isto pesa na estimativa (detalhe em `PROPOSTA.md` §3)
- **Construção por IA:** 4 sessões de frente: (1) cliente Mercado Pago + assinatura + modo; (2) Pix e cartão no checkout com reserva; (3) webhook, reconciliação de 15 min e estado monotônico; (4) estorno, chargeback e e2e T1 a T18 (com T10b e T17b a T17d, da conferência de Segurança). Fator **1,5** (inédito).
- **Horas do dono:** 1,0 h (conta e credenciais de sandbox, cadastrar a chave Pix de teste, conferir taxas e prazo de estorno, aprovar a decisão D-LO-5) + 0,5 h de conferência do ciclo T1 a T18 no endurecimento.

## 5. Para o framework (seção 8 do relatório; espera a retro, não muda o módulo agora)
Quando a loja terminar, o `modulos/pagamentos.md` ganha uma **variante Mercado Pago** só se ela aparecer de novo em outro trabalho (regra da segunda ocorrência aplicada a módulos, 15 §4). As três lições candidatas, a confirmar na construção: (1) "assinatura sobre manifest, não sobre o corpo → decidir sempre pelo `GET`"; (2) "idempotência de efeito, não só de evento, quando o processador manda várias notificações por pagamento"; (3) "o modo de teste não se deduz do prefixo da credencial".
