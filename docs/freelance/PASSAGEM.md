# Passagem — <codinome do trabalho> — AAAA-MM-DD

O cliente precisa conseguir operar, publicar e recuperar o produto sem o freelancer.

## 1. Contas (todas em nome do cliente desde o Dia 0)
| Conta | Titular | Freelancer removido ou rebaixado em | Observação |
|---|---|---|---|
| Repositório | | | |
| Hospedagem | | | |
| Banco de dados | | | |
| Processador de pagamento | | | modo produção ativo? |
| Domínio e DNS | | | |
| E-mail transacional | | | domínio verificado? |
| Monitoramento de erros | | | |

## 2. Segredos
- [ ] Todos no cofre do cliente (gerenciador de senhas ou variáveis da hospedagem); nenhum em e-mail ou chat.
- [ ] Chaves de teste rotacionadas ou removidas depois da virada para produção.
- [ ] Nenhuma cópia de segredo ou de dado do cliente fica com o freelancer (contrato, LGPD).

## 3. Runbooks entregues (em `docs/` do repositório do cliente)
- [ ] Publicar uma versão (deploy)
- [ ] Aplicar migration (antes do deploy; código tolera o schema antigo)
- [ ] Backup e restauração, com a data da última restauração testada
- [ ] Virada do pagamento para produção e o que fazer quando um evento novo for tratado
- [ ] Rotação de segredos
- [ ] Onde olhar quando algo quebra (logs, alertas, status dos fornecedores)

## 4. Suporte
- [ ] Canais de atendimento (pré e pós) em nome do cliente, com a pessoa que responde nomeada
- [ ] Prazos combinados de resposta e de resolução
- [ ] Onde fica o histórico das conversas
- [ ] Canal e prazo do freelancer na garantia; plano depois dela (se contratado)

## 5. Treinamento
- [ ] Sessão com quem opera o painel administrativo — gravação:
- [ ] Perguntas frequentes do suporte ao usuário final

## 6. Relatório final
- Números medidos: portões, testes, axe, desempenho, com data e SHA.
- O que ficou fora do escopo e o que se recomenda depois.
- Janela de garantia: de <data> a <data>.

**Recebido por:** · **Data:**
