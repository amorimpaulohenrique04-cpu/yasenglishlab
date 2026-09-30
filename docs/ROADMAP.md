# Roadmap

## Propósito

Este arquivo é a fonte operacional da sequência de implementação do Yas English Lab. A ordem existe para reduzir retrabalho, fechar dependências antes das projeções e impedir que fases futuras antecipem decisões ainda abertas.

## Roadmap operacional oficial

- **P00 — visão, requisitos e direção arquitetural**
- **P01 — documentação/fontes de verdade**
- **P02 — Engineering Foundation**
- **P03 — Harness Engineering**
- **P04 — Design System**
- **P05 — Domain Model**
- **P06 — Auth / RBAC / RLS**
- **P07 — Canonical Vertical Slice**
- **P08 — Testing & Evals**
- **P09 — CI/CD**
- **P10 — Observability / Analytics / Audit**
- **P11 — Ratchet / ADRs**
- **P12 — Engineering System 1.0**
- **P12.5 — Windows/local environment hardening**
- **P13 — Learning Core / Aulas V1**
- **P14 — Materiais V1**
- **P15 — Practice Engine V1**
- **P16 — Agenda / Live Booking**
- **P17 — Teacher Operations**
- **P18 — Admin Content**
- **P19 — Assessment Engine**
- **P20 — Progresso**
- **P21 — Home definitiva**
- **Gate — Billing provider**
- **P22 — Billing produção**
- **Gate — direção visual/site público**
- **P23 — Site público**
- **P24 — Notificações**
- **P25 — Closed Beta**
- **Gates — hosting + políticas operacionais**
- **P26 — Production Readiness**

O início de P15 depende do gate de governança `pre-p15-architecture-governance-gate` estar concluído e verificado. Registrar esse gate não inicia a implementação de Practice.

## Princípios e invariantes

- Source of truth vem antes de projection/read model.
- Home definitiva vem depois dos domínios que agrega.
- Segurança, autorização, acessibilidade e observabilidade são preocupações contínuas; não ficam adiadas para uma fase final.
- Cada fase fecha implementação, testes, evidência e checkpoint antes da próxima.
- Fase posterior não reabre decisão estrutural silenciosamente.
- Blocker estrutural deve ser registrado antes de avançar.
- Questões ainda presentes em `OPEN_QUESTIONS.md` não recebem respostas inventadas por agentes.

## O que não fazer

- Pedir a um coding agent “faça o portal inteiro”.
- Construir projeções como fonte autoritativa antes do domínio correspondente.
- Adiar autorização/RLS para uma fase posterior.
- Avançar para a próxima fase com gate obrigatório vermelho ou blocker estrutural não registrado.
- Transformar uma decisão ainda aberta em contrato por inferência.

## Legacy roadmap — superseded

A sequência histórica `P0 requisitos → P1 foundation → ... → P19 produção` foi substituída pelo roadmap operacional acima. Ela é preservada apenas como referência histórica e não deve ser usada para planejar, iniciar, nomear ou concluir novas fases.

## Interfaces

[ARCHITECTURE.md](./ARCHITECTURE.md) · [DEFINITION_OF_DONE.md](./DEFINITION_OF_DONE.md) · [TESTING.md](./TESTING.md) · [OPERATIONS.md](./OPERATIONS.md) · [OPEN_QUESTIONS.md](./OPEN_QUESTIONS.md)

## Critérios de aceitação

- Toda fase possui dependências conhecidas.
- Estado e decisões são persistidos entre fases.
- Uma fase pode ser verificada de forma independente.
- A sequência ativa deste arquivo não contradiz o Harness.
