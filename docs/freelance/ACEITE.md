# Aceite — <codinome do trabalho> — AAAA-MM-DD

**Commit entregue:** `<sha>` · **CI:** <link do run verde> · **Ambiente:** produção <url>

Toda linha precisa de **evidência** (link, captura, saída de comando com data). Linha sem evidência conta como vermelha. Linha que não se aplica leva o motivo, aceito pelo cliente.

## 1. Correção
- [ ] `lint` exit 0 e saída vazia · `typecheck` 0 · testes N ✓ · e2e suíte inteira — evidência:
- [ ] Critérios de aceite da proposta, um por um — evidência:
- [ ] Telas conferidas contra a fidelidade aprovada: principais contra a alta (`FIDELIDADE.md` §3), demais contra os wireframes (§2); diferença sem pedido de mudança é defeito — evidência:
- [ ] Revisão textual sem achado nos textos da interface, e-mails e mensagens (`analistas/revisao-textual`) — evidência:

## 2. Segurança (`modulos/seguranca.md`)
- [ ] Teste de acesso cruzado: cada papel tenta ler e escrever dado de outro usuário e é recusado — evidência:
- [ ] Anônimo não lê nada privado (tabelas, funções `SECURITY DEFINER`, arquivos) — evidência:
- [ ] Nenhum segredo no repositório nem no bundle do cliente — evidência:
- [ ] Limite de requisição nas rotas públicas (formulários, login) — evidência:

## 3. Acessibilidade (`modulos/acessibilidade.md`)
- [ ] axe sem violação nas telas do escopo — evidência:
- [ ] Fluxo principal completo só com teclado, foco sempre visível — evidência:
- [ ] Capturas a 140% de fonte e 360 px de largura, em todos os temas — evidência:

## 4. Pagamentos (`modulos/pagamentos.md`, se houver)
- [ ] Ciclo em modo de teste: compra, falha de cartão, estorno, recompra — evidência:
- [ ] Webhook reenviado duas vezes não duplica nada — evidência:
- [ ] Duas abas pagando ao mesmo tempo não cobram duas vezes — evidência:
- [ ] Roteiro de virada para produção executado (chaves, endpoint, eventos) — evidência:

## 5. Resiliência
- [ ] Rede desligada ao salvar: nada do que foi digitado se perde — evidência:
- [ ] Reenvio do mesmo pedido não duplica — evidência:
- [ ] Toda escrita confere as linhas afetadas; nenhum `error` descartado (lint ou guarda) — evidência:

## 6. Privacidade (`modulos/privacidade-lgpd.md`)
- [ ] Exclusão de conta apaga os dados pessoais (e cancela cobranças ativas) — evidência:
- [ ] Amostra do log sem dado pessoal — evidência:
- [ ] Política de privacidade e termos publicados e ligados ao cadastro — evidência:

## 7. Desempenho
- [ ] Orçamento da proposta medido (ex.: LCP no celular ≤ <x> s) — evidência:

## 8. Operação (`modulos/operacao.md`)
- [ ] Backup restaurado pelo menos uma vez — evidência:
- [ ] Alertas de erro (Sentry) e de cobrança dos fornecedores ligados — evidência:
- [ ] Runbooks da passagem escritos (ver `PASSAGEM.md`) — evidência:

## 9. Suporte (`modulos/suporte.md`)
- [ ] Canal de pré-aquisição visível antes do pagamento e testado: e-mail de teste recebido e respondido — evidência:
- [ ] Canal de pós-aquisição visível na área logada e testado — evidência:
- [ ] Quem responde, prazo de primeira resposta e onde fica o histórico, por escrito — evidência:
- [ ] Canal e prazo do suporte do freelancer na garantia, por escrito — evidência:

**Resultado:** <N> de <M> linhas verdes · linhas não aplicáveis com motivo: <lista>
**Aceito por:** · **Data:**
