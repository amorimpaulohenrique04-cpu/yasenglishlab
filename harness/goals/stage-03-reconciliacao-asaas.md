# GOAL — stage-03-reconciliacao-asaas: Reconciliação Asaas robusta (3a, SQL + testes)

Status: in-progress (SQL e testes escritos; execução pendente no CI Database)

Owner: agent (revisão humana obrigatória)

Created: 2026-10-13

Updated: 2026-10-13

## Objective

Impedir que corrida webhook x `complete_billing_checkout` perca pagamento: erro transitório (checkout ainda não vinculado) não vira REJECTED imutável e é retentável; CREATING órfão expira e libera o usuário. A rota (3b) é tarefa do próximo agente.

## Visible result

Webhook com `checkoutId` não vinculado responde erro retentável (PT503 `BILLING_EVENT_RETRY`) sem gravar evento; o reenvio do mesmo evento é APLICADO após o vínculo. Usuário com CREATING órfão > 60 min consegue novo checkout.

## Relevant context

- `supabase/migrations/20261006134431_stage_03b_billing_core.sql` (reconcile), `20261006012928_billing_checkout_foundation.sql` (checkout), `20261012120000_stage_02_notification_payment_dedupe.sql` (dedupe de notificação).
- Nova migration: `20261013120000_stage_03_billing_reconciliation_retry.sql` (decisões no cabeçalho).
- `src/server/billing/asaas-webhook.ts`, `event-repository.ts`, `docs/BILLING.md`.

## Acceptance criteria

- [ ] `scripts/test-billing-webhook-concurrency.mjs` verde no CI (webhook x complete; CONFIRMED x RECEIVED; reenvio transitório).
- [ ] `billing_core.sql` e `billing_checkout.sql` verdes (transitório vs terminal, expiração 60 min, casos negativos).
- [ ] Eventos já gravados, DUPLICATE/STALE e AMOUNT_MISMATCH inalterados.
- [ ] Rota 3b reconhece `PT503`/`BILLING_EVENT_RETRY` e responde 503 (próximo agente).

## Allowed files / domains

Migration aditiva, `supabase/tests/billing_*.sql`, `scripts/test-billing-webhook-concurrency.mjs`, `scripts/run-sql-tests.mjs`, este GOAL.

## Forbidden areas

Editar migrations aplicadas; regra de comparação de valor (exige sandbox Asaas); remote/db reset; commit/push.

## Mandatory tests

- `pnpm verify:db` e `node scripts/run-sql-tests.mjs integration` (exigem Postgres local; não rodados sem Docker).
- `node --check` + prettier nos `.mjs` tocados.

## Required evidence

Saída do job Database do CI; handoff com riscos.

## Definition of done

Critérios acima marcados com evidência do CI e revisão humana de migration/segurança; `harness/feature_list.json` atualizado pelo agente de integração.
