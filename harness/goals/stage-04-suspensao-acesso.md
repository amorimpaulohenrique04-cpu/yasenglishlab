# GOAL — stage-04a: Gate de acesso por assinatura (SQL)

Status: in-review (SQL escrito, testes NÃO executados)  
Owner: agent/human  
Created: 2026-10-13  
Updated: 2026-10-13

## Objective

Implementar no banco o gate do ADR 0016: aluno com assinatura só acessa conteúdo e aulas ao vivo com `subscriptions.status` em `ACTIVE`/`TRIALING`. Suspensão derivada, sem mutar matrícula/progresso; staff e usuários que nunca tiveram assinatura não são afetados.

## Visible result

`PAST_DUE`/`EXPIRED`/`CANCELLED` perdem material, asset/vídeo, gravação, recursos de aula, progresso, prática, reserva e entrada na sala; voltar a `ACTIVE` restaura tudo.

## Relevant context

- `docs/adr/0016-access-suspension-on-payment-failure.md`
- `supabase/migrations/20261013130000_stage_04_subscription_access_gate.sql`
- `supabase/tests/subscription_access.sql` (`node scripts/run-sql-tests.mjs subscription-access`)

## Acceptance criteria

- [ ] `private.has_paid_access(uuid)` sem grant a clientes; staff e sem-assinatura isentos.
- [ ] Negativo por chokepoint: can_read_material/lesson_asset/live_recording/session_resource, trigger em lesson_progress/practice_attempts/session_bookings, join da sala.
- [ ] Normalização restaura acesso; cancelar reserva continua permitido.
- [ ] Nenhuma migration aplicada foi editada; enrollments/cohort_memberships intocados.

## Allowed files / domains

`supabase/migrations/` (nova), `supabase/tests/`, `scripts/run-sql-tests.mjs`, `harness/goals/`.

## Forbidden areas

`reconcile_billing_event`, `reserve_billing_checkout`, Etapa 3; camada TS/UI (próximo agente).

## Mandatory tests

- `npm run verify:db`, `npm run verify:security`, suítes SQL `integration` e `rls` (rodam só no CI/com Docker).

## Required evidence

Saída do CI das suítes SQL. Local: nada executado (sem Docker).

## Pendências

Liberar reservas futuras em EXPIRED/CANCELLED (ADR 0016 d.4); assessments fora do gate; camada TS/UI.

## Definition of done

Critérios acima verdes no CI, revisão humana (RLS/billing) e `harness/feature_list.json` atualizado.
