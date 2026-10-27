# Descoberta — loja-online — 2026-10-26

> **Trabalho de portfólio com cliente fictício** (issue framework-aprendido#33, repositório privado). O "cliente" é fictício e documentado; o Pedro faz o papel dele no aceite. Toda resposta inventada vem marcada **[premissa]** (abreviação de "premissa do cliente fictício"). Nenhum dado real de pessoa ou empresa.
> Template: `kit/freelance/DESCOBERTA.md` · Framework na `origin/main` `43c43f3` · PM do portfólio

**Cliente:** Ateliê Alecrim, cosméticos artesanais (nome e perfil fictícios) [premissa] · **Quem decide e quem aceita:** a dona do ateliê, papel feito pelo Pedro · **Tempo de resposta combinado:** até 24 h em dia útil [premissa]

## 0. Perfil do cliente fictício [premissa]
- **Quem é:** uma artesã que fabrica sabonetes, velas aromáticas, hidratantes e óleos corporais na cozinha adaptada de casa, numa capital do Sudeste. Vende há 3 anos pelo Instagram (cerca de 4 mil seguidores) e fecha a venda pelo WhatsApp.
- **Volume:** cerca de 60 pedidos por mês, com ticket médio de R$ 85 e picos no Dia das Mães e no Natal (até 3 vezes o volume normal).
- **Operação:** ela mesma produz, embala e posta. Tem uma ajudante dois dias por semana. Usa celular para tudo; o notebook é antigo e fica para planilhas.
- **Formalização:** MEI na ocupação de saboeira independente, que consta da lista do MEI, a conferir com contador. Tem conta Mercado Pago pessoa jurídica e chave Pix cadastrada.

## 1. O problema
- **Alternativa real hoje:** o catálogo vive em destaques do Instagram e numa planilha. O pedido chega por mensagem; ela passa o Pix manualmente, confere o comprovante no app do banco e anota o estoque no caderno [premissa].
- **O que dói, com número:** cerca de 1 h por dia respondendo "tem?", "quanto é?" e "qual o frete?". Uns 3 pedidos por mês se perdem por demora na resposta, e já vendeu 2 vezes o último item do estoque para duas pessoas diferentes [premissa].
- **Critério de sucesso (vai para o aceite):** (a) um comprador consegue achar, pagar e receber a confirmação sem trocar mensagem; (b) a dona vê o pedido pago, separa e muda o status pelo celular; (c) o estoque nunca vende o que não tem; (d) zero cobrança perdida ou duplicada no ciclo de teste do §5 do 15.

## 2. Quem usa
| Papel | O que precisa fazer | Aparelho e condição | Quantos |
|---|---|---|---|
| **Visitante** | Ver catálogo, buscar, ver produto (ingredientes, modo de uso, aroma, tamanho), simular frete, montar carrinho | Celular, vindo do link da bio do Instagram, muitas vezes no 4G [premissa] | ~1.500 visitas/mês [premissa] |
| **Comprador** | Tudo do visitante + criar conta no checkout (e-mail e senha; o carrinho não se perde), pagar (Pix ou cartão), acompanhar pedido, ver histórico, excluir a conta | Celular (~85%) [premissa] | ~60 pedidos/mês, ~40% recompra [premissa] |
| **Dona (admin)** | Cadastrar produto e variação, ajustar estoque, ver pedidos, mudar status (pago → separado → enviado → entregue), estornar, ver vendas do mês | Celular na bancada de produção; notebook às vezes [premissa] | 1 (mais a ajudante, sem acesso no MVP) |

- **O que cada papel não pode ver nem fazer:** o visitante e o comprador nunca veem pedido, endereço ou e-mail de outro comprador, nem o painel. O comprador não altera preço, estoque nem status. A dona não vê dados de cartão; eles nunca passam pelo servidor da loja, porque o pagamento é tokenizado ou hospedado pelo Mercado Pago. A ajudante fica fora do MVP: um segundo papel de admin é pedido de mudança. Compra como convidado, sem conta, também fica fora (ideia I-03 do prospecto, opcional).

## 3. Dinheiro
- **O produto cobra alguém?** [x] pagamento único (pedido com vários itens) · [ ] assinatura · [ ] sinal · [ ] marketplace
- **Meios:** [x] Pix · [x] cartão de crédito (à vista e parcelado, com juros por conta do comprador) [premissa] · [ ] boleto (ela não quer, por causa da baixa conversão e da compensação lenta) [premissa]
- **Processador:** **Mercado Pago** (decisão do Pedro em 26-Out-2026). A conta é PJ (MEI), no nome dela, com chave Pix cadastrada [premissa]. A doc atual exige chave Pix cadastrada para oferecer Pix (conferido em 26-Out; ver `RISCOS_MERCADO_PAGO.md`).
- **Nota fiscal:** MEI que vende para pessoa física é dispensado de emitir nota, salvo se o comprador pedir [premissa, a conferir com contador; não é aconselhamento jurídico]. **Fora do escopo:** quando pedirem, ela emite à mão no emissor gratuito. O processador não emite nota fiscal (15 §2.1).
- **Estorno, cancelamento e reembolso:** arrependimento em até 7 dias da entrega (art. 49 do CDC, compra fora do estabelecimento), com estorno total. Produto aberto ou usado só se tiver defeito. A dona estorna pelo painel. Pedido Pix não pago expira em **30 minutos** e devolve o estoque [premissa].

## 4. Dados
- **Dados pessoais:** nome, e-mail, telefone (WhatsApp), endereço de entrega e histórico de pedidos. CPF só se o Mercado Pago exigir no meio escolhido; a conferir no sandbox no Dia 0, e de preferência coletado pelo próprio Mercado Pago, não pela loja.
- **Dado sensível:** **nenhum, por decisão de desenho.** A ideia de perguntar "tem alergia?" foi descartada, porque seria dado de saúde (LGPD, art. 11). No lugar dela, a página do produto lista os ingredientes completos (INCI) e os alérgenos de fragrância [premissa].
- **Retenção:** pedidos ficam 5 anos (prova de venda e CDC), com o titular desvinculado na exclusão. Conta sem pedido é apagada a pedido, na hora. Carrinho abandonado, 30 dias [premissa; prazos são decisão do dono, Privacidade 14 §2].
- **Política e termos:** não tem. Entram no escopo como páginas a partir de um modelo, com revisão dela; não é aconselhamento jurídico.

## 5. Sistemas e conteúdo
- **Sistemas existentes:** nenhum para integrar. Instagram e WhatsApp entram só como **links** (botão de WhatsApp com mensagem pronta; link da bio). Não há integração com Correios nem Melhor Envio (fora do escopo).
- **Conteúdo:** ela entrega as fotos (celular, fundo claro) e as descrições de 38 produtos numa planilha modelo enviada no aceite, **até o Dia 1** [premissa]. Já tem logo e uma paleta de 3 cores, mas não tem guia de marca. Para o portfólio, as fotos são geradas ou de banco livre, marcadas como ilustrativas.
- **Domínio e e-mail:** sem domínio próprio. Para o portfólio, a URL de demonstração da Vercel basta. Num cliente real, o `.com.br` fica no nome dela (cerca de R$ 40 por ano, a conferir). O e-mail de atendimento é um Gmail do ateliê [premissa].

## 5b. Suporte
- **Hoje:** antes da compra, pela DM do Instagram e pelo WhatsApp; depois, só pelo WhatsApp [premissa].
- **No produto novo:** WhatsApp para dúvidas antes da compra (botão em toda página de produto) e e-mail mais WhatsApp depois, com o número do pedido. Ela responde em até 1 dia útil, das 9 às 18 h [premissa].
- **As 5 perguntas que mais ouve (viram o FAQ):** 1. "Qual o prazo e o valor do frete para minha cidade?" 2. "Serve para pele sensível ou tem algum ingrediente X?" 3. "Quanto tempo dura o sabonete ou a vela?" 4. "Posso retirar aí?" 5. "Faz kit para presente?" [premissa]

## 6. Prazo e restrições
- **Data que não pode passar:** a loja no ar até **início de dezembro**, para pegar o Natal, que é o pico do ano [premissa]. Classe `data-fixa` de fato, com folga: a meta da proposta é 23-Nov.
- **Se apertar, sai primeiro:** a busca textual (fica só o filtro por categoria), o histórico de pedidos na conta (o e-mail de confirmação basta) e a tela de vendas do mês no painel.
- **Stack ou fornecedor exigido:** Mercado Pago (exigência). O resto segue a stack de referência (15 §3.1: Next.js, Supabase, Vercel). Trocar o Stripe pelo Mercado Pago torna o módulo Pagamentos **inédito** (`modulos/pagamentos.md` §1).

## 6b. Frete e entrega [premissa]
Frete fixo por região, cadastrado no painel, sem cotação automática:

| Região | Modo | Valor | Prazo informado |
|---|---|---|---|
| Mesma cidade e região metropolitana | motoboy, combinado por WhatsApp | R$ 15 | 1 a 2 dias úteis |
| Retirada no ateliê | combinada por WhatsApp (o endereço não aparece no site) | grátis | a combinar |
| Restante do estado | Correios (postado por ela) | R$ 25 | 3 a 7 dias úteis |
| Sudeste e Sul | Correios | R$ 30 | 4 a 9 dias úteis |
| Demais regiões | Correios | R$ 40 | 6 a 12 dias úteis |

A região é escolhida pelo **CEP**, pela faixa do primeiro dígito, numa tabela no banco. Frete grátis acima de um valor fica fora do MVP: é "cupom ou promoção" (pergunta 15).

---

## 7. As 15 perguntas do estudo de caso (`estudos-de-caso/e-commerce/loja-online-plataforma/README.md` §2)
| # | Pergunta | Resposta |
|---|---|---|
| 1 | O que vende e quantos produtos no lançamento? | Cosméticos artesanais: **38 produtos** (faixa "até 50") em 5 categorias: sabonetes, velas, hidratantes, óleos e kits [premissa] |
| 2 | Variações? | Sim: **aroma** (lavanda, alecrim, laranja-doce, sem fragrância) e **tamanho** (90 g ou 140 g; vela de 150 g ou 300 g). Cerca de 90 variações no total, cada uma com estoque e preço próprios [premissa] |
| 3 | Fotos e descrições prontas? | Fotos de celular e descrições em planilha. Ela ajusta, e eu entrego a planilha modelo no aceite. Revisão de texto e fotos profissionais ficam **fora do escopo** [premissa] |
| 4 | Orçamento e mensalidade? | Projeto até **R$ 6.500**; mensalidade até **R$ 150**, fora as taxas de venda [premissa] |
| 5 | Data limite? | Início de dezembro (Natal) [premissa] |
| 6 | Formas de pagamento? | Pix e cartão de crédito com parcelamento até 6x, com juros por conta do comprador. Sem boleto [premissa] |
| 7 | CNPJ ou MEI? | MEI [premissa] |
| 8 | Como entrega? | Motoboy local, retirada e Correios, postados por ela. Frete fixo por região (tabela 6b) [premissa] |
| 9 | Para onde vende? | Brasil todo; 70% das vendas são no próprio estado [premissa] |
| 10 | Logo, cores, nome e domínio? | Logo e 3 cores, sim; nome, sim; domínio, não (§5) [premissa] |
| 11 | Instagram e WhatsApp? | Instagram com ~4 mil seguidores e WhatsApp Business. Viram o link da bio e o botão da loja [premissa] |
| 12 | Loja de referência? | Gosta de lojas de cosmético natural com foto grande, lista de ingredientes e "como usar" na página do produto [premissa] |
| 13 | Quem opera e qual a familiaridade? | Ela mesma, pelo celular; familiaridade média (Instagram e app de banco), sem prática com sistema de gestão [premissa] → o painel precisa funcionar a 360 px |
| 14 | Nota fiscal automática? | Não (§3); **fora do escopo** [premissa] |
| 15 | Cupons, frete grátis ou promoções? | Gostaria de um cupom de 10% na primeira compra, mas aceita deixar para depois: **fora do escopo** (cupons avançados) e candidato a pedido de mudança [premissa] |

---

## 8. Perguntas das nove áreas (14 §2), com a fonte
| Área | Respostas (as fontes estão na tabela do 14 §2) |
|---|---|
| **UX/UI** | Usa celular a 360 px, no 4G; a dona usa o painel no celular. Telas do 1º marco: as 14 do mapa (`FIDELIDADE.md` §1). Temas claro e escuro, escala de 140%, WCAG 2.2 AA. Regra do catálogo que pesa aqui: o painel admin com muitas colunas quebra em 360 px → listas em cartões no celular. Protótipo antes do código (fidelidades do 15 §12) |
| **Segurança** | Dados pessoais: nome, e-mail, telefone e endereço em `pedidos` e `perfis`. Quem lê o quê: comprador, só os próprios pedidos (RLS); dona, todos, por papel `admin` verificado no servidor; anônimo, só o catálogo publicado. Segredos: token de acesso e assinatura secreta do webhook do Mercado Pago, chave de serviço do Supabase e chave do provedor de e-mail, só em variável de ambiente da Vercel. Classes a vigiar: acesso cruzado a pedido (04 cat. 1 e 2), preço adulterado no cliente (o servidor recalcula o total a partir do banco), webhook forjado (assinatura), enumeração de pedido por ID (UUID e RLS) |
| **DevOps** | CI no GitHub Actions do repositório público, gratuito para repositório público (a conferir no Dia 0). Deploy na Vercel (Hobby para a demonstração; num cliente real, a conta e o plano são dele). Backup: `pg_dump` semanal e uma restauração testada antes do aceite. Cotas que podem parar: o projeto gratuito do Supabase pausa por inatividade (a conferir no Dia 0; para a demonstração é aceitável, para um cliente real não) |
| **Desempenho** | Métricas do tipo loja: LCP no celular da home e da página do produto ≤ 2,5 s no 4G simulado; imagens otimizadas (`next/image`, WebP); o JS da página de produto com orçamento a fixar no Dia 0. No fluxo de desenvolvimento: custo por sessão em `dados/sessoes.csv` e estimado × realizado em `dados/estimativas.csv` |
| **Marketing** | A alternativa real é Instagram + WhatsApp + Pix manual. O produto ataca o gargalo da resposta manual (1 h/dia) e a venda dupla do último item. Promessa da interface: "compre em 2 minutos, com confirmação na hora". Sem plano grátis (não é SaaS). Critério de valor: ≥ 50% dos pedidos pela loja, e não pela DM, em 60 dias [premissa; medido pela dona] |
| **Suporte** | Pré-compra: botão de WhatsApp e FAQ. Pós-compra: e-mail e WhatsApp com o nº do pedido. Prazo de 1 dia útil. Autoatendimento: FAQ com as 5 perguntas do §5b, página de trocas e devoluções e status do pedido na conta. Ciclo: pergunta repetida vira item do FAQ, pelo painel; FAQ editável fica fora do MVP: é texto fixo no código, e muda por pedido |
| **Back-end e dados** | Dados: `produtos`, `variacoes` (preço em centavos e estoque), `categorias`, `pedidos`, `itens_pedido`, `fretes_regiao`, `eventos_pagamento` e `perfis`. Quem muda: só o servidor (`service_role`) escreve pedido e estoque; a dona, pelas Server Actions com guarda de papel. Migration antes do deploy, tolerando o schema antigo. Rotinas: reconciliação de 15 em 15 min para Pix e expiração de reservas, diária para o resto, com trava contra execução sobreposta. Webhook responde em < 22 s (limite do Mercado Pago, conferido em 26-Out) |
| **Pagamentos** | Mercado Pago, com taxas a conferir no Dia 0: a página oficial de tarifas respondeu 403 em 26-Out. O preço mora em `variacoes.preco_centavos`, catálogo único. O total é recalculado no servidor, e o valor enviado ao Mercado Pago sai do banco. Webhook com `x-signature` verificado e idempotente; reconciliação com alerta. Pedido não pago → estoque devolvido na expiração; estornado → acesso não se aplica, mas o estoque é devolvido só se a dona marcar "não enviado". Detalhe em `RISCOS_MERCADO_PAGO.md` |
| **Privacidade e LGPD** | Mapa: nome, e-mail e telefone (finalidade: entrega e contato do pedido; base: execução de contrato); endereço (entrega; contrato); histórico de pedidos (obrigação legal e defesa, 5 anos). Operadores: Mercado Pago, Supabase, Vercel e o provedor de e-mail, todos nomeados na política. O titular exporta (JSON na conta) e exclui (pedidos ficam sem titular). Sem cookie de marketing no MVP, logo sem banner de consentimento além do aviso. Não é aconselhamento jurídico |

---

## 9. Classificação
- **Tipo de produto:** **Loja** (15 §3.2): Base + Pagamentos (único) + e-mail + admin. Portão adicional do tipo: ciclo completo de compra, estorno e recompra em modo de teste. Risco do tipo: nota fiscal, frete e estoque fora do escopo sem estar escrito → os três estão escritos aqui e na proposta.
- **Módulos base:** Segurança · Acessibilidade · Privacidade (LGPD) · Operação · Suporte, todos prontos no `starter`, com Suporte só como método (`modulos/suporte.md`).
- **Módulos contextuais:** **Pagamentos (único)**, inédito nesta variante por ser Mercado Pago, não Stripe · **E-mail transacional**, proposto no 15 §4.2, sem arquivo de módulo · **Painel administrativo**, proposto, sem arquivo.
- **Inédito** (o que não cabe em nenhum módulo pronto):
  1. Adaptação do Pagamentos ao **Mercado Pago**: Pix com QR e expiração, cartão, assinatura do webhook, estorno, chargeback e reconciliação.
  2. **Catálogo** com categorias, variações (aroma × tamanho) e busca.
  3. **Carrinho e pedido com vários itens** e frete fixo por região de CEP. O starter vende um produto por pedido.
  4. **Estoque por variação com reserva** durante o Pix aberto e baixa conferida na aprovação.
  5. **Painel administrativo:** produtos, estoque, pedidos, status e estorno.
  6. **E-mails de pedido:** recebido, pago, enviado e estornado.
- **Riscos vistos (viram issues `risco` no Dia 0 do repositório):** R1 Mercado Pago inédito no framework · R2 venda dupla do último item (estoque concorrente) · R3 Pix pago depois da expiração local · R4 conteúdo (fotos e planilha) atrasado · R5 projeto Supabase gratuito pausado na demonstração · R6 frete fixo abaixo do custo real em regiões distantes (prejuízo por envio) · R7 regularização sanitária do cosmético artesanal (Anvisa), que é do negócio e não do software, mas a loja não pode prometer o que o rótulo não tem · R8 o starter só existe como branch provisório.
