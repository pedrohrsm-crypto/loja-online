---
name: Erro (com causa raiz)
about: Registro de defeito que alimenta a retro e o catálogo 04 do framework
title: "erro: <o defeito, com número se possível>"
labels: erro
---

## O que aconteceu
<!-- Sintoma observado, onde, quando, quem percebeu (usuário? portão? dono?) -->

## Causa raiz
<!-- Não é o sintoma. Pergunte "por quê?" até chegar à decisão ou premissa errada. -->

## Categoria (04 do framework)
- [ ] 1 Banco/RLS/migrations  - [ ] 2 Auth  - [ ] 3 Billing  - [ ] 4 CI/testes
- [ ] 5 A11y/contraste  - [ ] 6 Design/CSS  - [ ] 7 Mobile  - [ ] 8 Domínio
- [ ] 9 Framework/PWA  - [ ] 10 Deploy/ambiente  - [ ] 11 Integrações  - [ ] 12 Processo

**Classe no 04:** <!-- número do catálogo (ex.: 12.5) ou "nova". É o que mede a reincidência por classe. -->

## Já aconteceu antes? (regra da segunda ocorrência — obrigatório)
- [ ] Não, primeira vez → conserto + label `licao-candidata`
- [ ] Sim (#issue / commit: ____) → o conserto **precisa** vir com primitivo, guarda ou lint (label `guarda`)
- [ ] A guarda reprova também um **canário de classe**: uma variante que ainda não apareceu (04, padrão 11)

## Por que nenhum portão pegou?

## Conserto

## Prevenção proposta
<!-- Guarda automatizada > item de checklist > regra escrita. -->
