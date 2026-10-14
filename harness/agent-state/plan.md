# Plano - Etapa 11 (stage-11-flow-gap-closure)

Goal: `harness/goals/stage-11-fechamento-fluxo.md`. Branch `fix/etapa-11-fechamento-fluxo` a partir de main@4621d9c. PR unica, commits por bloco.

1. A+B (yas-database): migration `20261014120000_stage_11_access_closure.sql` (concessao explicita + backfill, `has_paid_access` fail-closed, placement com CANCELLED pago, COMPLETED automatico + gates ACTIVE|COMPLETED, Pratica por matricula, RPC de matriculas sem turma) e `supabase/tests/access_closure.sql`.
2. C (yas-backend): espelho TS da regra, Pratica sem matricula, read models aceitando COMPLETED, actions Admin, fixtures E2E.
3. D (yas-frontend): `/support`, aviso em `/progresso`, "Curso concluido", card Admin, bloco de concessao.
4. E: workflow `notifications-cron.yml` + runbook.
5. F: ADRs 0017-0019, docs de dominio, OPEN_QUESTIONS, evidence, failure-log/ratchet.
6. Validacao focada -> verify:db/security/agent/ui -> CI oficial (verify:full). yas-qa revisa read-only.
