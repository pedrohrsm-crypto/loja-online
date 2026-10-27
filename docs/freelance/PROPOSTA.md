# Proposta — loja-online — 2026-10-26

**Trabalho de portfólio com cliente fictício** (issue framework-aprendido#33, repositório privado): o Pedro aceita no papel do cliente. Nada é cobrado; o preço é exercício (15 §2.4). **Validade da proposta:** 2026-11-02 · **Versão:** 1
**Insumos:** `DESCOBERTA.md`, `PROSPECTO.md`, `RISCOS_MERCADO_PAGO.md`, `FIDELIDADE.md` §1 (todos nesta pasta)

## 1. O que será entregue
Uma loja online própria do Ateliê Alecrim, em que o comprador acha o produto pelo celular, vê os ingredientes e o frete, paga por Pix ou cartão pelo Mercado Pago e acompanha o pedido. A dona cadastra produtos, controla o estoque e despacha os pedidos pelo celular, sem trocar mensagem para fechar venda.

| Módulo | O que inclui neste trabalho | Critério de aceite (verificável; barra do 15 §5) |
|---|---|---|
| **Segurança** (base, starter) | Contas de comprador e de dona (papel `admin` em `perfis.papel` sem `GRANT UPDATE`, **segundo fator TOTP para a dona**), autorização no servidor, as 9 regras de servidor da `FIDELIDADE.md` §1, RLS com `GRANT` por coluna, segredos só na Vercel, cabeçalhos, limite de requisição no login e no checkout | Teste de acesso cruzado verde por papel: comprador B vê 0 pedidos de A; anônimo e comprador recebem 404 no `/admin`; `ASSERT` de privilégio nas migrations; varredura de segredos limpa |
| **Acessibilidade** (base, starter) | WCAG 2.2 AA nas 14 telas; temas claro e escuro; 360 px; escala de 140%; teclado | axe sem violação no e2e das 14 telas; navegação só por teclado no fluxo de compra; capturas a 140% × 360 px × 2 temas |
| **Privacidade** (base, starter) | Política de privacidade e termos a partir de modelo (revisados pela dona); exportação dos dados em JSON; exclusão de conta que apaga de verdade e mantém o pedido sem titular; log sem dado pessoal | Teste de exclusão de ponta a ponta verde; amostra do log sem e-mail, telefone nem endereço |
| **Operação** (base, starter) | CI com os 4 portões desde o 1º commit; deploy na Vercel; backup semanal com **uma restauração testada**; alerta de erro e de falha da reconciliação; runbooks (migrations, pagamento em produção, virada sandbox → produção) | Link do run verde no commit do aceite; registro da restauração com data; captura dos alertas disparados |
| **Suporte** (base) | Botão de WhatsApp em toda página de produto (pré-compra); e-mail + WhatsApp com o nº do pedido (pós-compra); FAQ com as 5 perguntas da descoberta; página "Trocas e devoluções" com o caso "chegou quebrado" (prospecto I-09); prazo de 1 dia útil escrito | Mensagem de teste enviada e respondida nos dois canais; FAQ e página de trocas publicadas |
| **Pagamentos — Mercado Pago** (contextual, **inédito**) | Pix com QR, copia e cola e contagem de 30 min na loja (I-06); cartão pelo Card Payment Brick, com parcelas; webhook com `x-signature` verificado e decisão sempre pelo `GET` na API; idempotência de evento e de efeito; estorno total pelo painel com confirmação dupla (I-10); chargeback vira alerta; reconciliação a cada 15 min (Pix) e diária; selos honestos de confiança perto do botão de pagar (I-07) | Ciclo **T1 a T18** (com T10b e T17b a T17d) do `RISCOS_MERCADO_PAGO.md` §3 em sandbox, com evidência: compra, recusa, Pix pago e expirado, pago depois de expirar, estorno, recompra, webhook repetido e forjado, duas abas, último item disputado, reconciliação que recupera |
| **Catálogo** (inédito) | Categorias, produtos com variações (aroma × tamanho, preço e estoque por variação), busca textual, página do produto com ingredientes (INCI) e alérgenos em destaque e filtro "sem fragrância" (I-01); carga inicial dos 38 produtos a partir da planilha modelo, feita **uma vez** pela IA no Dia 1 | Os 38 produtos e as ~90 variações publicados com dados da planilha; busca acha por nome e aroma; LCP no celular ≤ 2,5 s na home e no produto (4G simulado, medição registrada) |
| **Carrinho, checkout e frete** (inédito) | Carrinho no navegador, que sobrevive a fechar a aba; frete fixo por região de CEP já no produto e no carrinho (I-02); checkout com endereço e **total recalculado no servidor** | Total adulterado no cliente é ignorado (teste); queda de rede no checkout não perde o carrinho; reenvio não duplica o pedido |
| **Estoque** (inédito) | Estoque por variação; **reserva** durante o pagamento aberto (30 min) e baixa conferida na aprovação; devolução na expiração e, no estorno, se a dona marcar "não enviado" | Nunca vende abaixo de zero: teste T13 (último item disputado) e T9 (duas notificações) verdes |
| **Painel administrativo** (contextual proposto, **inédito**) | Pedidos (pagos primeiro, filtros, status pago → separado → enviado → entregue, estorno); produtos e variações (criar, editar, fotos, publicar, estoque); fretes por região. Lista em cartões no celular | A dona (Pedro no papel) faz, num celular a 360 px: cadastrar 1 produto com 2 variações, despachar 1 pedido e estornar 1, sem ajuda |
| **E-mails do pedido** (contextual proposto, **inédito**) | Ao comprador: recebido (Pix aguardando), pago, enviado, estornado. À dona: **aviso de pedido pago** com link para o pedido (I-04, versão e-mail). Enviados fora do caminho do webhook | Os 5 e-mails chegam no ciclo T1, T3, T6, com remetente configurado |

**Baixa fidelidade anexada:** jornadas, mapa de 14 telas e mapa de acesso em `FIDELIDADE.md` §1 (versão 2, conferida por UX/UI e Segurança em 26-Out, com os 16 achados incorporados). Aceitar esta proposta aprova também a baixa fidelidade; mudança nela depois do aceite é pedido de mudança (item 7).

## 2. Fora do escopo
O que não está aqui nem no item 1 não está incluído.
- **Nota fiscal** (emissão ou integração com emissor); MEI emite à mão quando pedirem.
- **Marketplace** (vários vendedores, repasse).
- **Cupons e promoções avançadas**: cupom de primeira compra, frete grátis acima de um valor, combos. Candidatos a pedido de mudança.
- **Cotação de frete por Correios ou Melhor Envio**, etiqueta e rastreio automático. O frete é fixo por região, e o código de rastreio é digitado pela dona no status "enviado".
- **Boleto**; estorno **parcial**; parcelamento sem juros por conta da loja.
- Compra **como convidado** (I-03), segundo usuário admin (ajudante), **aviso por WhatsApp** (I-04 via WhatsApp), **importação de planilha no painel** (I-05: a carga inicial é feita uma vez pela IA), "comprar de novo" (I-08), resumo financeiro e "vendas do mês" no painel (I-11), kit montado pelo comprador (I-12).
- App nativo; Instagram Shopping; Analytics e Pixel; programa de fidelidade.
- Fotos profissionais, redação de descrições, logo e identidade visual. No portfólio, imagens ilustrativas.
- Regularização sanitária dos produtos (Anvisa) e orientação contábil ou jurídica.

## 3. Estimativa e premissas (15 §2.3: dois recursos e um calendário)
**Estimativa sem histórico: hipótese.** `dados/estimativas.csv` tem só o piloto-a, simulado, que não calibra (15 §2.3). Fator **1,3** nos módulos do catálogo e **1,5** no inédito. Teto de horas do dono decidido pelo Pedro: **12 h** (26-Out).

| Item | Horas do dono (base) | Fator | Horas do dono | Construção por IA (sessões) |
|---|---|---|---|---|
| Descoberta e proposta (ler, decidir, aceitar) | 1,50 | 1,3 | 1,95 | 1 (esta sessão de PM) |
| Segurança · Acessibilidade · Privacidade · Suporte (decisões do Dia 0) | 1,00 | 1,3 | 1,30 | pronto no starter |
| Operação (contas Supabase e Vercel, backup) | 0,50 | 1,3 | 0,65 | 1 (Dia 0: starter → `loja-online`, kit, CI) |
| Média e alta fidelidade (aprovar wireframes e telas principais) | 1,00 | 1,3 | 1,30 | 2 + 3 conferências de analista |
| Prévias diárias (3 × 15 min) | 0,75 | 1,3 | 0,98 | — |
| Endurecimento (conferir a barra) e aceite e passagem | 1,00 | 1,3 | 1,30 | 1 rodada completa (5 áreas) |
| **Inédito: Pagamentos Mercado Pago** (sandbox, chave Pix, taxas, prazo de estorno, D-LO-5, conferir T1 a T18) | 1,50 | 1,5 | 2,25 | 4 |
| **Inédito: catálogo, carrinho e frete, estoque, painel, e-mails** (decisões de regra) | 1,00 | 1,5 | 1,50 | 6 |
| PM (integração e relatório) | — | — | — | 3 |
| **Total** | **8,25** | | **11,23 h** | **17 frentes e PM + 8 de analista** |

**Custo de IA (hipótese):** pelas medianas internas de custo por sessão (26-Out; n pequeno): frente US$ 6,28, analista US$ 5,32, PM US$ 11,40. Conta: 10 frentes do inédito × 6,28 × 1,5 + 3 frentes do catálogo × 6,28 × 1,3 + 8 rodadas de analista × 5,32 × 1,3 + 4 sessões de PM × 11,40 × 1,3 ≈ **US$ 233**. Câmbio de referência R$ 5,40 por dólar (**não conferido**) → cerca de **R$ 1.260**.

**Calendário (15 §2.3):** 11,2 h ÷ **5 h por semana** dedicadas à loja (premissa: o Pedro divide a semana com outros projetos) = **2,2 semanas de trabalho**, mais a espera do cliente (o Pedro mesmo, até 24 h). → **cerca de 4 semanas corridas**, de 26-Out a 23-Nov, das quais cerca de 3 dias dependem de resposta do cliente. **Depois do pedido de mudança nº 1: cerca de 3 semanas, até 16-Nov.** As horas do dono não mudam; o que se comprime é a espera, porque as contas ficaram prontas no mesmo dia do aceite.

Premissas (se uma falhar, prazo e preço são revistos):
- O cliente (o Pedro, no papel) responde em até 24 h em dias úteis.
- A conta de sandbox do Mercado Pago (aplicação e credenciais de teste; a chave Pix de teste foi dispensada), o projeto Supabase e o projeto Vercel estão criados até o Dia 0 (feito em 26-Out). Num cliente real, ficam no nome dele.
- A planilha modelo, com textos, ingredientes, preços e estoque, está preenchida até o Dia 1 (3-Nov, depois do pedido de mudança nº 1). No portfólio, a IA preenche com dados fictícios, e as imagens são ilustrativas.
- Até 14 telas, conforme a lista da `FIDELIDADE.md` §1.
- Base de código: a cópia do `starter-provisorio` (`e94c649`) no repositório `loja-online` (decidido no aceite de 26-Out).
- **Margem sobre o teto: 0,8 h.** Se o inédito do Mercado Pago passar de 2,25 h do dono, o plano B é o Checkout Pro (`RISCOS_MERCADO_PAGO.md` §0).

## 4. Cronograma (porte curto, 16 §2; feriados de 2-Nov e 20-Nov respeitados)
| Marco | Data | Entrega | Pagamento (exercício) |
|---|---|---|---|
| Aceite da proposta e da baixa fidelidade | ~~qua 28-Out~~ **seg 26-Out** ✅ | lista do Dia 0 (abaixo) | 40% · R$ 2.600 |
| Contas prontas (sandbox, Supabase, Vercel) | ~~sex 30-Out~~ **seg 26-Out** ✅ | — | — |
| **Dia 0** | **ter 27-Out** (antes: 3-Nov) | starter no `loja-online`, kit `--freelance`, CI verde; **média fidelidade** (wireframes em código na prévia) para aprovar até **qui 29-Out** | — |
| **Dia 1** | **ter 3-Nov** (2-Nov é Finados) | **alta fidelidade só em código** das 4 telas principais (Produto, Carrinho, Pagamento Pix, Admin pedidos); catálogo carregado; prévia | — |
| Dias 2 e 3 | qua 4 e qui 5-Nov | fatias: checkout e estoque, Mercado Pago (Pix, cartão, webhook), painel e e-mails; prévia diária | — |
| Reserva do inédito | sex 6-Nov | folga para o Mercado Pago (o que estourar) | — |
| **Dia 4 · Endurecimento** | seg 9-Nov | barra inteira (15 §5), rodada completa da `analise`, ciclo T1 a T18 | — |
| Entrega para aceite | qua 11-Nov | produto publicado na URL de demonstração, `ACEITE.md` com evidência | 40% · R$ 2.600 |
| **Aceite final e passagem** | seg 16-Nov (antes: 23-Nov) | termo de aceite, `PASSAGEM.md`, README do portfólio com capturas | 20% · R$ 1.300 |
| Garantia | até qua 16-Dez | defeitos da barra | — |
| Retro (P3) | semana de 23-Nov | estimado × realizado em `dados/estimativas.csv`; estudo de caso atualizado | — |

Folga para a data do cliente (início de dezembro, Natal): cerca de **2 semanas**, depois da antecipação (pedido de mudança nº 1). A reserva do inédito caiu de 2 dias para 1, porque o Dia 1 cai depois do feriado de Finados.

### O que precisamos do cliente até o Dia 0
- [ ] Conta do Mercado Pago com aplicação criada, **credenciais de teste** e assinatura secreta do webhook. **Nunca em arquivo nem em commit:** vão direto para as variáveis da Vercel.
- [ ] Chave Pix cadastrada na conta (exigência do Mercado Pago para oferecer Pix).
- [ ] Projeto Supabase e projeto Vercel criados, com o dono convidado.
- [ ] Planilha modelo preenchida (textos, ingredientes, preço e estoque por variação) até o Dia 1.
- [ ] Logo e as 3 cores, e o número do WhatsApp e o e-mail de atendimento (fictícios no portfólio).
- [ ] Quem aprova os wireframes (Dia 0) e as telas principais (Dia 1), com retorno em até 1 dia útil: o Pedro.

## 5. Preço (exercício, 15 §2.4)
```
piso  = 11,2 h × R$ 180 (D-F2)                        = R$ 2.016
      + custo de IA ≈ US$ 233 × R$ 5,40 (não conferido) = R$ 1.260
      + margem de risco 20% (inédito Mercado Pago)    = R$   655
      + garantia: 2 h × R$ 180                        = R$   360
      = cerca de R$ 4.300
```
**Valor do pacote: R$ 6.500.** É o orçamento do cliente fictício e fica na ponta de baixo da faixa citada para loja sob medida com freelancer: cerca de R$ 5 mil a R$ 25 mil, segundo blogs de plataformas e hospedagens (fonte com interesse comercial, buscada em 26-Out; **não é dado medido**). A margem sobre o piso é de cerca de 51%. Custos de fornecedor (hospedagem, banco, e-mail, domínio, taxas do Mercado Pago) são do cliente, direto nas contas dele.

## 6. Garantia e suporte
30 dias depois do aceite final (D-F3), para defeitos da barra de qualidade. Canal: e-mail do freelancer, com primeira resposta em até 1 dia útil. Pedido novo não é garantia: vira pedido de mudança. Depois da garantia (opcional): R$ 180 por hora ou pacote mensal de 3 h por R$ 480.

## 7. Pedido de mudança
| # | Data | Mudança | Impacto no prazo | Impacto no preço | Aceito em |
|---|---|---|---|---|---|
| 1 | 26-Out | A pedido do cliente (contas prontas antes do previsto): Dia 0 antecipado de 3-Nov para **27-Out**; alta fidelidade **só em código**, sem Figma (15 §12.1, regra 5) | −1 semana (aceite final de 23-Nov para 16-Nov) | nenhum; horas do dono iguais (11,2 h) | 26-Out, por escrito, na sessão do PM |

## 8. Comparação com o caminho de plataforma pronta (Nuvemshop, estudo de caso)
A recomendação do estudo de caso **para um cliente real com este perfil continua de pé**. O código próprio foi escolhido pelo Pedro para o portfólio (decisão de 26-Out), e esta tabela registra o custo dessa escolha.

| Critério | Plataforma pronta (Nuvemshop) — estudo de caso de 30-Set | Código próprio (esta proposta) |
|---|---|---|
| **Prazo** | 9 dias úteis + 1 de reserva (estimado, não medido) | ~3 semanas corridas (26-Out a 16-Nov, depois do pedido de mudança nº 1), limitadas pelas 5 h/semana do dono, não pela construção |
| **Horas do freelancer** | ~40 h, quase todas manuais (configurar, cadastrar, testar) | **~11 h do dono** + ~US$ 233 de IA; o cadastro e a construção vão para a IA |
| **Preço ao cliente (pela mesma taxa de R$ 180)** | ~R$ 7.200 de trabalho, ou o pacote que o freelancer fixar | R$ 6.500 (piso ~R$ 4.300) |
| **Custo mensal do cliente** | Plano da plataforma, de grátis com taxa por venda a algumas centenas de reais (estudo; **a conferir**) | Hospedagem e banco: no gratuito, a Vercel Hobby é de uso não comercial e o Supabase gratuito pausa por inatividade (**ambos a conferir**). Uma loja real provavelmente precisa dos planos pagos, em dólar. **Isso pode passar do teto de R$ 150/mês do cliente**, e para este perfil é o ponto fraco do código próprio |
| **Taxas de pagamento** | Iguais (Mercado Pago ou Nuvem Pago) | Mercado Pago: Pix 0,0% e cartão à vista 4,98% (painel, 26-Out); parcelamento e prazos a conferir |
| **Autonomia no dia a dia** | Alta: a dona muda layout, cria cupom e instala apps (frete, nota fiscal) sozinha | Alta no escopo (produtos, estoque, pedidos, frete, estorno); **baixa fora dele**: cupom, layout novo ou nota fiscal pedem desenvolvedor |
| **Propriedade** | Loja na plataforma; sair dela é migrar | Código dela (licença MIT do starter), sem taxa da plataforma, migrável |
| **Qualidade provada** | A da plataforma, sem evidência própria | A barra do 15 §5 com evidência (acesso cruzado, axe, ciclo T1 a T18, restauração) |

**Leitura do PM:** para a dona fictícia (orçamento mensal de R$ 150, quer mexer sozinha em promoção), a plataforma pronta ganha em custo mensal e em autonomia fora do escopo. O código próprio ganha em propriedade, em evidência de qualidade e em ensinar o framework (Mercado Pago, estoque com reserva). Para o portfólio, que é o objetivo da framework-aprendido#33, o código próprio é o caminho certo. Para um cliente real com este perfil, o framework recomendaria a Nuvemshop.

## 9. Aceite desta proposta
**Aceita** pelo Pedro, no papel da dona do Ateliê Alecrim, em 2026-10-26, por escrito, na sessão do PM da loja (resposta do Pedro: "aceito, siga as recomendações nas 4"). Registro: PR de aceite que segue o #35.

O aceite vale para esta proposta (versão 1), para a baixa fidelidade (`FIDELIDADE.md` §1, versão 2) e para as decisões tomadas junto:
- **Base de código:** cópia do `starter-provisorio` (`e94c649`) no repositório público `pedrohrsm-crypto/loja-online`.
- **D-LO-5:** Mercado Pago pelo Checkout Transparente (Orders API), com Pix com QR na loja e cartão pelo Card Payment Brick; o plano B é o Checkout Pro.
- **D-LO-6:** confirmação de e-mail por código de 6 dígitos na mesma tela do cadastro.

Marco de 40% (exercício, nada é cobrado): registrado no aceite.
