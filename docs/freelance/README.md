# Kit freelance (PFA-F)

Templates do [capítulo 15](../../15-entrega-freelance.md). Instalados em `docs/freelance/` do projeto com:

```bash
bash kit/instalar.sh <caminho-do-projeto> --freelance
```

| Etapa | Arquivo | Quem preenche |
|---|---|---|
| F0 · Descoberta | `DESCOBERTA.md` | dono, na conversa com o cliente |
| F1 · Proposta | `PROPOSTA.md` + `CONTRATO_CHECKLIST.md` + `FIDELIDADE.md` §1 (baixa) | dono; IA desenha, UX/UI e Segurança conferem |
| P1 · Dia 0 | `docs/DIA_ZERO.md` do kit geral + `modulos/operacao.md` + `FIDELIDADE.md` §2 (média) | PM; UX/UI e Revisão Textual conferem |
| P2 · Construção | `FIDELIDADE.md` §3 (alta, Dia 1) + um `modulos/<módulo>.md` por módulo usado | frentes; UX/UI confere a alta |
| F2 · Endurecimento | `ACEITE.md` | PM, com evidência |
| F3 · Passagem | `PASSAGEM.md` | PM e dono |
| P3 · Retro | `RETRO.md` | dono e PM (o PM conduz; 06 P3) |

Módulos base: segurança, acessibilidade, privacidade, operação e suporte (desde 30-Set-2026).

Módulo novo: só entra em `modulos/` depois de construído em **dois** trabalhos (15 §7).

> **Neste repositório:** os arquivos de `modulos/` citados acima e no `ACEITE.md` não estão aqui. Eles ficam no framework, que é privado, porque trazem casos internos de outros projetos e este repositório é público (desvio no `CLAUDE.md`).
