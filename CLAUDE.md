@AGENTS.md

# loja-online — instruções para sessões de IA

Loja online de cosméticos artesanais para um cliente **fictício** (Ateliê Alecrim), feita pelo PFA-F (capítulo 15 do framework) como MVP de portfólio. Repositório **público**: nada de chave, dado real de pessoa ou documento interno do framework aqui.

Framework: v2.0 (https://github.com/pedrohrsm-crypto/framework-aprendido)

## Idioma
- Português do Brasil em código, commits, documentos e interface. Nunca variantes europeias ("registrado", não "registado"; "arquivo", não "ficheiro").
- Tratar o dono do produto por: "o senhor" (Pedro). O Pedro também faz o papel do cliente no aceite.

## Stack e versões
- Framework: Next.js 16 (`next` 16.3.7) — **leia a doc instalada** (`node_modules/PACOTE/docs`) antes de usar qualquer API. A memória e o brief não são fonte.
- Node: **24**, declarado só no `.nvmrc`; o CI lê o arquivo e a Vercel precisa estar em 24.x. A mesma versão na bancada, no CI e em produção (04, 4.4).
- Banco/Auth: Supabase · Pagamentos: **Mercado Pago** pela Orders API (Checkout Transparente, D-LO-5, #10); o código do Stripe herdado do starter é substituído na fatia de pagamentos · Hospedagem: Vercel

## Papéis de trabalho (seção 18 do framework; hierarquia de contexto: Maestro → PM → agentes e analistas → subagentes)
- **PM** (uma sessão por projeto): lidera a equipe do projeto e é o interlocutor do dono. Abre e fecha a sprint semanal e a apresenta ao dono (relatório + board); delega frentes com brief; revisa as entregas pelo `pm-revisor`, que só revisa e devolve; **integra**: merge em `main`, migrations e deploy. Só o PM toca `main` e produção.
- **Agentes de área** (N sessões de frente: dev, marketing, devops…): cada um só na própria branch `front/NOME-DA-FRENTE`, em worktree própria; entrega PR com os portões rodados. Nunca faz merge nem deploy. Delega partes da frente aos seus subagentes. Modelo pelo risco (D-PM9): Opus se a frente toca migration, pagamento ou segurança; Sonnet nas demais; o brief diz qual.
- **Analistas** (skill `analise`): medem uma dimensão e propõem; não escrevem no produto.
- **Subagentes**: recebem uma tarefa fechada, trabalham somente em leitura salvo ordem escrita e devolvem no formato pedido.
- **Maestro** (fora do projeto, um para todos): guarda o padrão de trabalho de todos os PMs e divide a cota de IA entre projetos; as orientações dele chegam ao dono pela seção "Orientações do Maestro" do relatório do PM. No fim do projeto, com a autorização do dono, fecha o projeto e atualiza o framework antes de aceitar projeto novo; os projetos ativos seguem em paralelo (18 §5, regra 10).
- O dono fala só com o PM. Um escritor por branch. Decisão do dono registrada não se reabre.

## Portões (rodar separados, nunca com `| tail`)
1. `npm run lint` → exit 0 **e** saída vazia
2. `npm run typecheck` → 0
3. `npm test` → verde; teste novo precisa ter sido visto falhar
4. `npm run test:sql` → bancada SQL (migrations com `ASSERT` de privilégio e testes de acesso cruzado)
5. `npm run e2e` → gera o build e roda a suíte inteira (04, 4.13)
6. Visual: temas × escala de 140% × 360 px quando houver interface; tabela de rotas do build igual à baseline

## Regras inegociáveis
- Nunca descartar `error`. Escrita confere as linhas afetadas.
- Migration **antes** do deploy, e o código tolera o schema antigo.
- RLS não protege colunas: `GRANT` por coluna e `ASSERT` de privilégio na migration.
- Uma regra de negócio mora em um lugar só.
- Toda cor vem de token com par em todos os temas; tamanhos em `rem`.
- Na **segunda** ocorrência de um bug, criar primitivo, guarda ou lint (procedimento PFA-01, 2.3).
- Todo número citado vem de um comando rodado, com data e SHA.
- `npm ci`, nunca `npm install`.
- Commit no formato `tipo(frente): texto (#issue)` — o tipo (`feat`, `fix`, `docs`…) alimenta as métricas; a issue dá rastreabilidade.
- Nada entra na `main` sem PR, sem os checks verdes e sem o veredito `aprovar` do `pm-revisor`.

## Método (seção 18 §8 do framework; skill `metodo`)
- O framework é a base de todos os níveis, no tamanho do contexto de cada um. A skill `metodo` responde por nível: **G** (Maestro), **M** (PM), **P** (agente de área e analista), **PP** (subagente). Peça o seu nível e não leia capítulo inteiro sem motivo; o que faltar, peça ao nível de cima.
- Todo subagente pré-carrega o cartão `metodo-cartao` (campo `skills: [metodo-cartao]` no frontmatter).
- Toda saída, de qualquer nível, termina com "Não medido" e "Para o framework", cada lição com a prova: até 3 linhas no subagente; até 5 lições agrupadas no agente de área e no analista; até 5 na seção 8 do relatório do PM. As lições sobem pelo funil: subagente → agente ou analista → PM (seção 8 do relatório de sprint) → Maestro (fechamento do projeto).

## Planejamento com as áreas (seção 14 do framework; plano em `docs/PLANEJAMENTO.md`)
- Projeto novo, ou fase nova, começa pelo plano com as nove áreas de produção (14 §2): UX/UI, Segurança, DevOps, Desempenho, Marketing, Suporte, Back-end e dados, Pagamentos e Privacidade. Cada área tem fonte citada ou motivo escrito para não se aplicar.
- Toda frente cita, na seção "Áreas consultadas" do brief, a regra ou o checklist de cada área que ela toca.
- O material das áreas é consulta: a decisão continua sendo do dono, registrada como issue `decisao`.

## Análise (seção 13 §7 do framework; skill em `.claude/skills/analise/`)
- Para analisar o projeto, use a skill `analise` ("rode a análise" ou `/analise [áreas]`): Desempenho, Revisão Textual, Agente Multidisciplinar, UX/UI, Segurança, DevOps e operação, Back-end/dados/runtime, Pagamentos e Privacidade/LGPD, cada uma com a sua matriz de referência (13 §2.4).
- A rodada **propõe primeiro**, organizada por tema e só do escopo deste projeto. Issue, PR ou comentário, só depois do aceite do dono.
- A matriz em `.claude/skills/analise/areas/` é cópia do framework: não edite. Entrada nova vai na tabela "Para a matriz" do relatório e sobe pelo funil; quem a leva ao framework, por PR, é o Maestro (18 §9).

## Trabalho para cliente (seção 15 do framework; só se instalado com `--freelance`)
- Nada se constrói antes da proposta aceita por escrito (`docs/freelance/PROPOSTA.md`). Mudança de escopo é pedido de mudança, com prazo e preço, antes de começar.
- Contas (repositório, hospedagem, banco, pagamento, domínio) em nome do cliente desde o Dia 0.
- O aceite passa pela barra inteira de `docs/freelance/ACEITE.md`, com evidência em cada linha.
- Código e dado do cliente nunca vão para o framework: a retro leva a lição, anonimizada, com o projeto por codinome.

## Gestão (Kanban + PMBOK 8 — seção 09 do framework; detalhe em `docs/GESTAO.md`)
- Fluxo: Opções → Com evidência → Pronta (ponto de compromisso) → Execução (WIP 3) → Integração (WIP 2) → Validação com cliente (WIP 20) → Concluída. Puxar só com espaço no limite.
- Classes de serviço: `urgente` (fura o WIP, máx. 1), `data-fixa`, padrão, `estrutural` (~20% reservados).
- Riscos e decisões são issues (`risco`, `decisao`). Decisão só se reabre com nova issue que cite a anterior.
- Ao iniciar uma sessão: olhar itens envelhecendo e bloqueados. Todo item concluído passa pela validação com cliente, ou registra por que dispensa.
- **Sprint = semana ISO, fechada na segunda** (fluxo contínuo; a sprint é a janela do relatório). O PM apresenta ao dono o relatório e o board (skill `gerencia`, `sprint fechar`), com as Orientações do Maestro; a reunião de segunda é do dono com o PM. Depois, `sprint abrir`.
- **Fim do projeto ou da fase:** o dono autoriza o PM a enviar o projeto ao Maestro (PFA-01, P3); o Maestro fecha o projeto e publica a nova versão do framework.
- **Cota de IA** (plano fixo: o risco é cota, não caixa): a fatia deste projeto vem do Maestro, no relatório da sprint; rodada completa da `analise` só no endurecimento.

## Fim de trabalho
Toda sessão termina com o bloco `=== FIM DE TRABALHO ===` (seção 7 do 05 do framework), ou com `=== NÃO RODE /clear AINDA ===` se algo faltar.
A linha `Sessão: <min> min · tokens <in>/<out> · US$ <custo> · <modelo>` sai do `get_session` (ou do painel da sessão) e vira uma linha em `dados/sessoes.csv` do framework, com o papel (`pm`, `frente`, `analista`): é a única fonte do custo por integração e da divisão da cota.

## Desvios deste framework (motivo obrigatório)
- **Sem `docs/PLANEJAMENTO.md` e `docs/CRONOGRAMA.md` próprios:** no PFA-F, as nove áreas foram respondidas na descoberta (`docs/freelance/DESCOBERTA.md` §8) e o cronograma está na proposta (`docs/freelance/PROPOSTA.md` §4). Os dois arquivos apontam para lá.
- **Primeiro commit direto na `main`** (`be991ac`, só o README): repositório vazio não tem base para PR. Daí em diante, só por PR.
- **Node 24 em vez do 22 do starter:** a bancada está no 24, e o 02 do framework pede ≥ 22. Declarado no `.nvmrc`.
- **Reconciliação de 15 min no GitHub Actions, não no cron da Vercel (a implementar na fatia de pagamentos):** o plano Hobby só aceita cron 1×/dia (doc da Vercel, conferida em 27-Out; risco #9). Até lá vale o cron diário do `vercel.json`.
- **Kit instalado sem a análise e sem os módulos (equivale a `--sem-analise`):** as skills `analise`, `metodo` e `metodo-cartao`, os subagentes `analista-*` e `pm-*` e `docs/freelance/modulos/` trazem dados internos de projetos privados, e este repositório é público. Chegam pelo framework anexado à sessão. Foram publicados por engano na branch `front/dia-0` em 27-Out e retirados no mesmo dia.
- **Sem proteção de branch criada pelo PM:** a sessão não tem ferramenta para isso; o Pedro liga em Settings → Branches (`docs/DIA_ZERO.md`).
