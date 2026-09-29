# Architecture Decision Records

Use ADR somente para decisões arquiteturais relevantes, com consequência durável. Não registre escolhas triviais.

## Template sugerido

```md
# ADR-XXXX — Título

Status: proposed | accepted | superseded
Date: YYYY-MM-DD

## Context
Qual problema/pressão motivou a decisão?

## Decision
O que foi decidido?

## Alternatives
Quais alternativas relevantes foram consideradas?

## Consequences
Benefícios, custos, riscos e restrições.

## Evidence
Links para benchmark, spike, issue, PR ou teste quando existir.
```

## Regras
- Não reescrever ADR aceito para esconder mudança de decisão; crie outro e marque o anterior como superseded.
- OPEN_QUESTIONS registra o que ainda não foi decidido.
- Documentos de domínio registram o estado atual da arquitetura.

- [0004 — Provider-neutral observability boundary](./0004-provider-neutral-observability-boundary.md)
