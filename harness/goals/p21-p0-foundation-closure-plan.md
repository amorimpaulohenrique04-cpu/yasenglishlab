# GOAL — p21-p0-foundation-closure-plan

Status: planned  
Owner: agent/human  
Created: 2026-10-02  
Updated: 2026-10-02

## Objective

Planejar P21.1/P21.2/P21.3 contra a main real, com mapa de dependências, migrations aditivas, contratos preservados, transações, compatibilidade e verificação. Esta entrega é exclusivamente planejamento; não autoriza execução automática do texto anexado.

## Visible result

Plano revisável em `harness/plans/p21-p0-foundation-closure.md`, ancorado no SHA remoto/local confirmado.

## Relevant context

- AGENTS.md; docs/README.md; PRODUCT, ROADMAP, ARCHITECTURE, DATA_MODEL.
- AUTH_RBAC_RLS, SECURITY, THREAT_MODEL, LIVE_CLASSES, BILLING.
- ADMIN_CONTENT, PRACTICE_ENGINE, OPEN_QUESTIONS, AUDIT_LOG, OBSERVABILITY.
- TESTING, DEFINITION_OF_DONE, OPERATIONS; ADRs 0002/0003/0006.
- Migrations e implementação Auth/Schedule/Teacher/Home; testes e evidências P16–P21.

## Acceptance criteria

- [x] SHA local coincide com main remota consultada.
- [x] Plano distingue comportamento existente, proposta e decisão pendente.
- [x] Quota/capacidade, RLS/cohorts, MFA/recovery e regressões possuem estratégia explícita.
- [x] Nenhum código de produto ou migration histórica foi alterado.

## Allowed files / domains

- harness/goals/p21-p0-foundation-closure-plan.md
- harness/plans/p21-p0-foundation-closure.md
- harness/agent-state/plan.md (registro do planejamento)

## Forbidden areas

- Código, banco, configuração de produção, migrations, workflows, implementação de features.
- Billing/P21.4+, alteração de decisões abertas sem autorização.

## Mandatory tests

Para este artefato: revisar o plano contra código/scripts reais e verificar diff/format dos documentos. Gates de execução estão no plano; não foram executados e não são reportados como PASS.

## Required evidence

- `git rev-parse main` e `git ls-remote origin refs/heads/main`: 94b574b40b8b05ed798f996294d2297ba92b5e31.
- Checkout main inicialmente limpo; consulta remota read-only concluída em 2026-10-02.
- Inspeção de migrations, guards, adapters, testes e scripts oficiais citados no plano.

## Definition of done

O artefato de planejamento está entregue quando revisado. A iniciativa de implementação permanece planned / verified:false até execução e gates finais, incluindo Official CI.
