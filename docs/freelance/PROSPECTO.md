# Prospecto do usuário final — loja-online — 2026-10-26

**SHA:** framework `43c43f3` (o repositório `loja-online` está vazio: sem commits em 26-Out) · **Rotas:** 0 em código; 14 telas planejadas (`FIDELIDADE.md` §1) · **Sinais do usuário presentes:** não medido (sem código; `contexto.py` não rodado) · **Rodada anterior:** nenhuma (linha de base) · **Custo:** incluído na linha única da sessão do PM

> Rodada **manual** do Agente Multidisciplinar (F0b do PFA-F; `ROTINA.md`: "sem conector, a rodada é manual"). Pacote de contexto: `DESCOBERTA.md` (deste diretório) e a issue framework-aprendido#33 (privado). Cliente fictício: toda evidência que vem da descoberta é, por origem, **premissa do cliente fictício**. Cito a seção (`D§n`), e o que não está nem lá vai marcado `[hipótese]`.

## 1. Quem é o usuário final
| Perfil | O que quer resolver | Em que condição usa | Evidência |
|---|---|---|---|
| **Comprador novo** | Comprar um presente ou um item de cuidado pessoal sem esperar resposta no WhatsApp | Celular, 4G, vindo do link da bio do Instagram, com pressa e pouca paciência para cadastro | D§2, D§1 (3 pedidos/mês perdidos por demora) |
| **Comprador recorrente** | Repetir o sabonete ou o aroma de sempre e saber onde está o pedido | Celular; ~40% recompra | D§2 |
| **Comprador cauteloso (pele sensível)** | Saber se o produto tem o ingrediente que ele evita, antes de pagar | Celular; lê a página do produto com atenção | D§4 (alergia descartada como dado; INCI na página), D§5b pergunta 2 |
| **Dona da loja** | Parar de responder "tem? quanto é? qual o frete?", nunca vender o que não tem e ver o pedido pago sem conferir comprovante | Celular na bancada, mãos ocupadas, interrupções; notebook antigo | D§1, D§2, D§7 pergunta 13 |

## 2. As jornadas
- **Comprador:** descobrir (Instagram → home ou produto) → decidir (página do produto: ingredientes, aroma, tamanho, frete pelo CEP) → pagar (Pix com QR ou cartão) → acompanhar (e-mail e conta) → pedir ajuda (WhatsApp ou e-mail) → trocar ou arrepender-se (7 dias) → sair (excluir conta).
- **Dona:** cadastrar (produto e variações) → receber (pedido pago) → separar e enviar (status) → resolver (estorno, troca) → acompanhar o mês (vendas) → ajustar o estoque.

## 3. Preocupações do usuário
| ID | Jornada | O que preocupa, dito como o usuário diria | Severidade | Evidência | Área dona |
|---|---|---|---|---|---|
| P-01 | Pagar (Pix) | "Paguei o Pix e a tela diz que expirou. Perdi o dinheiro? E o produto?" | **alta** | D§3 (expiração de 30 min); R3 em D§9 | Pagamentos · Back-end e dados |
| P-02 | Pagar | "Paguei e o pedido sumiu", ou "fui cobrado duas vezes" (duas abas, voltar no navegador, webhook atrasado) | **alta** | D§1 critério (d); 15 §5 Pagamentos | Pagamentos |
| P-03 | Receber (dona) | "Vendi o último sabonete de lavanda para duas pessoas de novo" | **alta** | D§1 ("já vendeu 2 vezes o último item"); R2 | Back-end e dados |
| P-04 | Decidir | "Tem óleo essencial de X? Posso usar com pele sensível?" A resposta precisa estar na página, senão ele vai para o WhatsApp ou desiste | **alta** | D§5b pergunta 2; D§4 | UX/UI · Marketing |
| P-05 | Decidir | "Quanto fica o frete para a minha cidade?" Se só aparece no fim do checkout, ele abandona | média | D§5b pergunta 1; D§6b | UX/UI |
| P-06 | Pagar | "Preciso criar conta só para comprar um sabonete?" | média | D§2 (comprar com e-mail ou conta); D§1 (pressa) | UX/UI · Segurança |
| P-07 | Pagar (cartão) | "Esse site é confiável para pôr meu cartão? É uma loja de garagem" | **alta** | D§0 (loja pequena, sem marca conhecida); dado do cartão no Mercado Pago (D§2) | Pagamentos · Marketing |
| P-08 | Acompanhar | "Paguei; e agora, quando chega?" O motoboy é "combinado por WhatsApp": quem chama quem? | média | D§6b (motoboy e retirada combinados por WhatsApp) | Suporte |
| P-09 | Trocar | "Chegou quebrado (vela de vidro) ou vazando. Como devolvo e quem paga o frete?" | média | D§3 (arrependimento de 7 dias, defeito); produto frágil `[hipótese]` | Suporte · Marketing |
| P-10 | Sair | "Quero apagar meus dados", e o pedido antigo precisa continuar valendo para a troca | baixa | D§4 (retenção de 5 anos, titular desvinculado) | Privacidade |
| P-11 | Cadastrar (dona) | "São 38 produtos e 90 variações: vou passar o fim de semana digitando no celular?" | **alta** | D§7 perguntas 1 e 2; D§5 (planilha até o Dia 1) | UX/UI · Back-end e dados |
| P-12 | Receber (dona) | "Como fico sabendo que caiu um pedido? Vou ter que ficar abrindo o site?" | **alta** | D§1 (hoje o aviso é a mensagem no WhatsApp) `[hipótese: aviso imediato é condição para largar a DM]` | Suporte · Back-end e dados |
| P-13 | Resolver (dona) | "Estornei sem querer", ou "estornei e o dinheiro não voltou para a cliente: o que digo a ela?" | média | D§2 (estorno pelo painel); prazo de estorno do Mercado Pago `[não conferido]` | Pagamentos · UX/UI |
| P-14 | Acompanhar o mês (dona) | "O valor que caiu na minha conta não bate com as vendas do site": taxa, parcelamento, prazo de recebimento | média | D§8 Pagamentos (taxas a conferir no Dia 0) | Pagamentos |
| P-15 | Descobrir | "O site demora a abrir no 4G; volto para o Instagram" | média | D§8 Desempenho (LCP ≤ 2,5 s); fotos de celular pesadas D§5 | Desempenho |
| P-16 | Pico (Natal) | "No Natal entra o triplo de pedidos. O site aguenta? Some algum pedido?" | média | D§0 (picos de até 3 vezes); D§8 DevOps (Supabase gratuito pausa) | DevOps · Back-end e dados |

## 4. Ideias de valor
| ID | Para quem | A ideia | Por que valeria (evidência) | Tamanho | Como validar | Área dona |
|---|---|---|---|---|---|---|
| I-01 | Comprador cauteloso | **Ingredientes completos (INCI) e alérgenos de fragrância em destaque** na página do produto, com filtro "sem fragrância" | P-04; D§5b pergunta 2 é a 2ª mais ouvida | P | Contar quantas perguntas "tem X?" chegam no WhatsApp em 30 dias, antes e depois | UX/UI · Marketing |
| I-02 | Comprador novo | **Frete pelo CEP na página do produto e no carrinho**, antes do checkout | P-05; D§6b (tabela simples: custo de construção baixo) | P | Taxa de abandono no checkout com e sem a estimativa (teste A/B depois do lançamento) | UX/UI |
| I-03 | Comprador novo | **Compra como convidado** (só e-mail), com conta criada depois pelo link do e-mail de confirmação | P-06 | M | % de pedidos de convidado e conversão do carrinho em 30 dias | UX/UI · Segurança |
| I-04 | Dona | **Aviso de pedido pago no WhatsApp ou e-mail da dona** na hora, com link direto para o pedido no painel | P-12 | P (e-mail) · M (WhatsApp, integração externa: fora do MVP) | Perguntar à dona, depois de 1 semana, se ela abriu o painel sem o aviso | Back-end e dados · Suporte |
| I-05 | Dona | **Importação da planilha modelo** (CSV) de produtos e variações no painel | P-11; D§5 (a planilha já existe) | M | Tempo da dona para cadastrar os 38 produtos: importação × digitação de 5 deles | Back-end e dados · UX/UI |
| I-06 | Comprador | **Tela do Pix com contagem regressiva, QR e "copia e cola"**, que vira "pago" sozinha, mais um e-mail com o código caso ele feche a aba | P-01, P-02 | M (parte do inédito Mercado Pago) | Pedidos Pix expirados ÷ criados; meta < 20% `[hipótese]` | Pagamentos · UX/UI |
| I-07 | Comprador | **Selos honestos de confiança** perto do botão de pagar: "pagamento processado pelo Mercado Pago", CNPJ, contato e política de trocas no rodapé | P-07 | P | Pergunta de campo: "o que faria você desistir de pagar aqui?" (5 compradores) | Marketing · Pagamentos |
| I-08 | Comprador recorrente | **"Comprar de novo"** no histórico de pedidos | D§2 (~40% recompra) | P | % de pedidos que nascem do botão em 60 dias | UX/UI |
| I-09 | Comprador | **Página "Trocas e devoluções" curta e clara**, com o caso "chegou quebrado" (foto pelo WhatsApp em 48 h) | P-09 | P | Chamados de troca resolvidos sem ida e volta de mensagem | Suporte |
| I-10 | Dona | **Confirmação dupla e motivo no estorno**, com texto pronto para mandar à cliente sobre o prazo de devolução do dinheiro | P-13 | P | Estornos por engano em 90 dias (meta 0) | Pagamentos · UX/UI |
| I-11 | Dona | **Resumo do mês:** vendido bruto, taxa estimada e líquido previsto | P-14 | M | A dona compara com o extrato do Mercado Pago e diz se bate | Pagamentos |
| I-12 | Comprador | **Kit para presente** como produto próprio (categoria "kits"), com campo de mensagem do cartão | D§5b pergunta 5; D§7 pergunta 1 (categoria kits) | P (como produto) · M (como montagem livre: fora do MVP) | Kits ÷ pedidos no Natal | Marketing · UX/UI |

## 5. Perguntas para o próximo contato com usuários
1. Para a dona: o que a faria abrir o painel todo dia, e qual aviso ela quer receber, e por onde (e-mail, WhatsApp, notificação)?
2. Para 5 compradores do Instagram: o que faria você desistir de pagar numa loja pequena que não conhece?
3. Para a dona: quantas vezes por mês alguém pede nota fiscal, troca ou "chegou quebrado"?
4. Para compradores de fora do estado: um frete de R$ 40 faz desistir? (valida a tabela da D§6b e o risco R6)
5. Para compradores recorrentes: preferem criar conta ou comprar só com o e-mail?

## 6. O que não foi possível avaliar
- `[não conferido]` sinais no código (rotas, termos, FAQ, guia): não há código; a próxima rodada roda o `contexto.py` sobre o repositório no endurecimento (Dia 4).
- `[não conferido]` taxas e prazos de recebimento do Mercado Pago (P-14, I-11): a página oficial de tarifas respondeu 403 em 26-Out.
- `[não conferido]` prazo máximo para estornar pelo Mercado Pago (P-13).
- Todo o perfil vem de cliente fictício: as severidades são hipótese até haver um cliente real (15 §0).

## 7. Estado dos itens anteriores
Primeira rodada (linha de base): nada a atualizar.

---
**As 3 preocupações mais severas para a proposta:** P-01/P-02 (Pix expirado ou cobrança perdida ou duplicada: o inédito do Mercado Pago), P-03 (venda dupla do último item: estoque com reserva) e P-12/P-11 (a dona precisa do aviso de pedido e de cadastrar 90 variações sem sofrer, senão volta para a DM). **Ideias que a proposta incorpora no escopo, por serem P e cobrirem preocupação alta:** I-01, I-02, I-06, I-07, I-09 e I-10. **Ideias opcionais (pedido de mudança):** I-03, I-04 por WhatsApp, I-05, I-08, I-11 e I-12 como montagem livre.
