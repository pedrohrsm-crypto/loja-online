# Dia Zero — loja-online

Procedimento PFA-01, passo 1.4. Marque `[x]` ou escreva o motivo ao lado. Os números entre parênteses apontam para o catálogo de erros (04) do framework.

**Framework:** v2.0 · **Data:** 2026-10-27 (antecipado de 3-Nov, pedido de mudança nº 1) · **Aprovado pelo dono:** [ ] (no merge do PR do Dia 0)

Portões medidos na bancada em 27-Out, Node 24.21, a partir de `npm ci` limpo: `npm audit --audit-level=high` 0 · lint exit 0 e 0 bytes · typecheck 0 · `npm test` 48/48 · `npm run test:sql` 2 migrations e 4 testes · `npm run e2e` 42/42.

## Planejamento com as áreas (passo 1.0, seção 14)
- [x] As 9 áreas respondidas na descoberta (`freelance/DESCOBERTA.md` §8) e aprovadas com a proposta em 26-Out; `docs/PLANEJAMENTO.md` aponta para lá (desvio no `CLAUDE.md`)
- [x] Riscos #2 a #9 e decisões #10 e #11 (fechadas, já decididas)
- [x] Portões do tipo Loja (15 §3.2): ciclo T1 a T18 em `freelance/RISCOS_MERCADO_PAGO.md` §3, cobrado no `freelance/ACEITE.md`

## Repositório e ambiente
- [x] `CLAUDE.md` preenchido, sem `<…>` restante
- [x] Node 24 só no `.nvmrc`; o CI lê `node-version-file`. O projeto `loja-online` da Vercel está em Node 24.x: o Pedro configurou em 27-Out, e o PM conferiu na API da Vercel no mesmo dia (`nodeVersion: 24.x`). Ainda não há deploy de produção pronto: o último deploy de produção aparece como `CANCELED` na mesma API (causa não conferida)
- [x] Guarda em `lib/guardas.test.ts` ("toda variável de ambiente lida no código está no .env.example"); as variáveis do Mercado Pago entram na fatia de pagamentos
- [ ] Não se aplica no porte curto: no máximo 2 frentes (15 §1, regra 5), sem script de worktree. Se abrir frente paralela, copiar o `.env.local` à mão e usar `npm ci`
- [x] Não há pasta de maquete: a média fidelidade é feita em código, nas próprias rotas (alta fidelidade só em código, mudança nº 1)
- [ ] Parcial: `frente`, `risco` e `decisao` nasceram com as issues #1 a #11. As outras 8 nascem quando a primeira issue de cada tipo for aberta (sem `gh` nesta sessão)

## CI desde o primeiro commit (4.1)
- [x] Proteção da `main`, criada pelo Pedro em 27-Out (a sessão não tem ferramenta para isso): PR obrigatório sem aprovação mínima (dono único; a revisão é do `pm-revisor`), check `portoes` obrigatório com a branch atualizada, conversas resolvidas, sem bypass para administrador, sem force push e sem exclusão
- [x] commitlint no CI sobre os commits do PR
- [x] Lint com `--silent` e saída vazia (o grep do starter reprovava sempre, por causa do `--max-warnings` do cabeçalho do npm; corrigido e visto falhar com um defeito plantado), typecheck, testes, bancada SQL, build e e2e da suíte inteira
- [x] `TZ: UTC` no CI; nenhum pipe em portão
- [x] `npm audit --audit-level=high` no CI. O starter vinha com 7 alertas, 1 crítico no Next 16.3.7 (GHSA-f87g-xv8r-7p7x): Next e `eslint-config-next` em 16.4.3 e `npm audit fix` → 0 alertas
- [x] Não se aplica: GitHub Actions em repositório público não consome minutos pagos

## Esqueleto
- [x] Do starter: `app/` → ações → `lib/` (domínio puro testável) → `lib/supabase/` (infra)
- [ ] Não no starter. Para um MVP de porte curto, custo maior que o benefício; reavaliar na retro
- [x] `lib/seguranca/guarda-area.ts` com testes em matriz
- [x] `proxy.ts` e `lib/seguranca/redirecionar.ts`, com teste
- [x] Logger com redação (`lib/observabilidade/logger.test.ts`); monitoramento de erros (Sentry) **não** no starter: decidir na fatia de operação
- [x] `lib/ui/tokens.test.ts`, com contraste
- [x] Não há elemento `fixed` no starter; vale quando a barra inferior do celular nascer (Dia 1)
- [x] Projetos `celular` (360 px), `computador` e `escuro`, com axe

## Gestão (seção 09)
- [x] Escala S; `docs/GESTAO.md` preenchido
- [x] `docs/GESTAO.md` §1
- [ ] Não criado: a sessão não cria Projects. No porte curto, o quadro do PM no framework (`project-manager/board/`) basta; criar o Projects é opcional, com o Pedro
- [x] Semanal: a segunda do relatório do PM. Mensal: não se aplica a um trabalho de 3 semanas
- [x] #2 a #11
- [x] Planos gratuitos (tabela abaixo). Alerta: a cota diária do Resend (100 e-mails) e a pausa do Supabase gratuito depois de 1 semana sem uso
- [ ] Na primeira semanal da loja (seg 2-Nov é feriado: medir na terça)

## Fornecedores (11.1, 2.7)
| Fornecedor | Preço | Cotas/limites | Política | Formato de webhook/secret | Conferido em |
|---|---|---|---|---|---|
| **Mercado Pago** (Orders API, sandbox) | Pix **0,0%**; cartão à vista **4,98%** (painel do Mercado Pago, 26-Out). **Não conferidos:** prazo de recebimento, parcelamento, prazo máximo de estorno (#6) | Expiração do Pix de 30 min a 30 dias (padrão 24 h); webhook com prazo de **22 s**, reentrega a cada 15 min | Exige chave Pix cadastrada na conta **real**; contas de teste sem acesso administrativo | `x-signature: ts=…,v1=…`, HMAC-SHA256 em hex sobre `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` (o corpo **não** é assinado; decidir pelo `GET`) | 26 e 27-Out-2026 (doc oficial + painel) |
| **Vercel** (Hobby) | Grátis; Pro para uso comercial (preço não conferido) | Cron **só 1×/dia**, com precisão de ±59 min (expressão mais frequente falha no deploy); 1 milhão de invocações e 100 GB de transferência por mês | **Hobby é só uso pessoal, não comercial**: uma loja real de cliente exige Pro (#7) | Não se aplica (o cron da Vercel manda `Authorization: Bearer <CRON_SECRET>`) | 27-Out-2026 (docs: cron usage-and-pricing, fair use) |
| **Supabase** (Free) | Grátis; Pro a partir de US$ 25/mês | 500 MB de banco, 50 mil MAU, 1 GB de storage, **2 projetos ativos**; **pausa depois de 1 semana sem atividade** | SMTP padrão manda **só para membros da equipe**, 2 e-mails/hora: compradores precisam de SMTP próprio | Não se aplica | 27-Out-2026 (pricing, guia de SMTP) |
| **Resend** (Free) — e-mail e SMTP do Auth, **decidido na D-LO-7 (#17), sem domínio próprio** | Grátis; Pro US$ 20/mês | 3.000 e-mails/mês, **100/dia**, 3 domínios | **Sem domínio verificado, só entrega no e-mail do dono da conta** e em endereços de teste (`delivered@resend.dev`, 04 4.8) → decisão D-LO-7 | Webhook de status não usado no MVP | 27-Out-2026 (pricing, doc do erro 403) |
| **GitHub Actions** | Grátis em repositório público | — | — | Plano B do cron de 15 min da reconciliação (#9): agendamento chama a rota por POST com segredo | 27-Out-2026 |

## Variáveis de ambiente (levantadas em 29-Out)
Os valores **nunca** vão para arquivo nem para commit: o Pedro cola no painel. As da Vercel valem para os ambientes Production e Preview. O comprador de teste do e2e manual usa o e-mail do dono da conta Resend (D-LO-7, #17).

| Variável | Onde | De onde vem | Quando | Estado |
|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel | Supabase → Project Settings → API | Dia 1 (catálogo) | [ ] |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel | Supabase → Project Settings → API (chave pública) | Dia 1 | [ ] |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel, **só servidor** | Supabase → Project Settings → API (chave secreta) | Dia 1 | [ ] |
| `NEXT_PUBLIC_SITE_URL` | Vercel | Endereço de produção da Vercel (`https://loja-online-….vercel.app`) | Dia 1 | [ ] |
| `CRON_SECRET` | Vercel | Texto aleatório longo, gerado pelo Pedro (ex.: gerador de senha, 32+ caracteres) | Dia 1 (o cron diário já está no `vercel.json`) | [ ] |
| Credenciais de **teste** do Mercado Pago: chave pública, access token e assinatura secreta do webhook | Vercel | Mercado Pago → Suas integrações → aplicação → Credenciais de teste; Webhooks → assinatura secreta | Fatia de pagamentos; os nomes finais entram no `.env.example` com o código (a guarda de `lib/guardas.test.ts` cobra) | [ ] |
| Chave de API do Resend e remetente (`onboarding@resend.dev`) | Vercel | Resend → API Keys (permissão só de envio) | Fatia de e-mails (4 e 5-Nov); nomes finais com o código | [ ] |
| SMTP do Auth com o Resend | **Supabase**, não Vercel | Supabase → Authentication → SMTP: host `smtp.resend.com`, usuário `resend`, senha = chave do Resend (dados da doc do Resend, a conferir na fatia) | Fatia de e-mails, junto com o código de 6 dígitos (D-LO-6, #11) | [ ] |

As variáveis do Stripe no `.env.example` são herança do starter e saem na fatia de pagamentos; **não** precisam ser criadas na Vercel. Depois de criar as do Dia 1, o primeiro deploy de produção é refeito pelo PM, que confere o estado `READY` na API da Vercel.

