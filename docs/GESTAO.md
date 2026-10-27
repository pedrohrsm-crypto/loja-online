# Gestão — loja-online

> Kanban e PMBOK 8 adaptados (framework, seção 09). **Escala:** S (porte curto, PFA-F)
> **Atualizado em:** 2026-10-27 · **Dono:** Pedro (também no papel do cliente fictício) · **PM:** sessão própria do PM da loja-online
>
> Este é o **único** documento de gestão mantido à mão. Riscos e decisões são **issues**
> (`risco`, `decisao`); o quadro é o GitHub Projects; as métricas saem das datas do GitHub.
> O relatório semanal do PM fica no framework, em `project-manager/relatorios/loja-online/` (seção 18).

## 1. Tese do produto (Governança)
- **Problema e para quem:** a dona de um ateliê de cosméticos artesanais vende pelo Instagram e pelo WhatsApp e perde tempo e vendas na resposta manual (`freelance/DESCOBERTA.md` §1)
- **Objetivo do próximo marco:** aceite final em 16-Nov-2026 (`freelance/PROPOSTA.md` §4)
- **Critério de sucesso (valor, não esforço):** os critérios (a) a (d) da `freelance/DESCOBERTA.md` §1; no portfólio, a demonstração publicada com a barra do 15 §5 inteira e evidência no `freelance/ACEITE.md`
- **Limites:** tempo do dono: teto de 12 h no trabalho, cerca de 5 h/semana · orçamento: planos gratuitos dos fornecedores (demonstração)
- **Fora do escopo:** `freelance/PROPOSTA.md` §2

## 2. Definição de Fluxo (Kanban)
| Coluna | Entra quando | Limite de WIP |
|---|---|---|
| Opções | Ideia, pedido de campo ou achado registrado | — |
| Com evidência | Quem pediu, quantos, que problema resolve | 10 |
| Pronta para começar | Cumpre a Definição de Pronto | 5 |
| *— ponto de compromisso —* | | |
| Execução | Puxada por uma sessão ou frente | 3 |
| Integração | PR com portões verdes | 2 |
| Validação com cliente | Em produção, aguardando uso real | 20 |
| Concluída | Validada, ou dispensa com motivo | — |

**Definição de Pronto para começar:** evidência de valor · brief com fronteira · critério de aceite verificável · classe de serviço · riscos anotados.
**Definição de Concluído:** DoD do template de PR + validação com cliente (ou dispensa com motivo).
**Bloqueio:** label `bloqueado`; continua contando no WIP.

## 3. Classes de serviço
| Classe | Label | Política |
|---|---|---|
| Urgente | `urgente` | Fura o WIP; no máximo 1; post-mortem obrigatório |
| Data fixa | `data-fixa` | Começa na data-limite menos o tempo de ciclo p85 |
| Padrão | — | Ordem por custo do atraso |
| Estrutural | `estrutural` | Cerca de 20% da capacidade reservada |

## 4. Cadências
| Cadência | Quando | Duração | Pauta |
|---|---|---|---|
| Revisão do quadro | Início de cada sessão do PM | | Itens envelhecendo, bloqueios |
| Sprint (semanal, dono + PM) | Segunda | | O PM apresenta o relatório e o board (`gerencia sprint fechar`), com as Orientações do Maestro · decisões pendentes · reabastecimento (`sprint abrir`) |
| Mensal | | | Valor · orçamento e cota de IA · partes interessadas · go/no-go do próximo marco |
| Retro curta | Fim de cada onda | 15 min | PFA-01, P3, passos 3.1 a 3.3, pelo PM |
| Fechamento | Fim do projeto ou da fase, com a autorização do dono | | O PM envia ao Maestro; o Maestro fecha e atualiza o framework (PFA-01, P3; seção 18 §10) |

## 5. Marcos e go/no-go (Cronograma + Governança)
| Marco | Data-alvo | Previsão por vazão | Critério de go/no-go |
|---|---|---|---|
| Média fidelidade aprovada | qui 29-Out | — (linha de base) | wireframes das 14 telas + não encontrado, conferidos por UX/UI e Revisão Textual |
| Entrega para aceite | qua 11-Nov | — | `freelance/ACEITE.md` com evidência em toda linha |
| Aceite final | seg 16-Nov | — | termo de aceite e `freelance/PASSAGEM.md` |

## 6. Orçamento mensal (Finanças)
| Item | Previsto | Realizado | Limite ou cota | Alerta configurado? |
|---|---|---|---|---|
| IA (plano fixo: conta a cota, não o caixa) | fatia do Maestro | consumo em `dados/sessoes.csv` | | aviso `allowed_warning` |
| | | | | |

## 7. Partes interessadas
| Quem | Interesse | Como é ouvido | Frequência |
|---|---|---|---|
| Dono | Valor e prazo do projeto | Reunião de segunda com o PM | Semanal |
| Maestro (fora do projeto) | Padrão de trabalho e cota de IA entre projetos | Orientações por escrito ao PM, na seção 9 do relatório de sprint | Semanal |
| | | | |

## 8. Recursos e capacidade
- **Capacidade semanal:** dono ~5 h · sessões de IA: no máximo 2 frentes abertas (15 §1, regra 5) · fatia da cota de IA: definida pelo Maestro
- **Latência de decisão do dono** (meta: ≤ 2 dias úteis):

## 9. Linha de base das métricas de fluxo
| Data | WIP | Vazão/semana | Idade máxima | Tempo de ciclo mediano / p85 |
|---|---|---|---|---|
| | | | | |
