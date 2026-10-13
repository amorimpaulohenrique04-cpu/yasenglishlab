# GOAL — stage-05a: Operação de Billing para ADMIN (leitura)

Status: in-review (SQL escrito, testes NÃO executados)  
Owner: agent/human  
Created: 2026-10-13  
Updated: 2026-10-13

## Objective

Dar ao ADMIN (aal2) visibilidade somente-leitura do que exige atenção operacional em Billing, sem expor payload, PII ou ids de pagamento. Sem replay/reprocessamento.

## Visible result

Três RPCs paginadas (limite ≤ 50): `admin_billing_rejected_events` (eventos Asaas REJECTED/IGNORED), `admin_billing_stuck_checkouts` (CREATING > 60 min ou READY vencida) e `admin_notification_failures` (deliveries FAILED ou PENDING atrasadas > 15 min).

## Relevant context

- `supabase/migrations/20261013150000_stage_05_admin_billing_operations.sql`
- `supabase/tests/admin_billing_operations.sql` (`node scripts/run-sql-tests.mjs admin-billing-operations`; também em `integration` e `rls`)
- `docs/adr/0016-access-suspension-on-payment-failure.md`, padrão `admin_*` de `20261004130000_stage_02_admin_teachers.sql`

## Acceptance criteria

- [ ] ADMIN aal2 lê; aal1/sem claim, STUDENT/TEACHER/SUPPORT, authenticated sem sub e anon negados (42501).
- [ ] Colunas exatas: sem `payload`, `event_id`, ids de checkout/pagamento, valores, destinatário, título/corpo.
- [ ] `processing_error` fora da allowlist é mascarado; `last_error_code` já restrito por CHECK.
- [ ] Parâmetros inválidos (limite fora de 1..50, offset fora de 0..10000, status fora da allowlist) falham com 22023.
- [ ] Nenhuma migration aplicada editada; `reconcile_billing_event` e o gate de acesso intocados.

## Allowed files / domains

`supabase/migrations/` (nova), `supabase/tests/`, `scripts/run-sql-tests.mjs`, `harness/goals/`.

## Forbidden areas

`reconcile_billing_event`, gate de acesso (`has_paid_access`), grants de tabela, camada TS/UI (próxima etapa), replay/reprocessamento.

## Mandatory tests

`npm run verify:db`, `npm run verify:security`, suítes SQL `integration` e `rls` (CI/Docker).

## Required evidence

Saída do job Database do CI. Local: apenas verify-db, verify-security, check-migrations, prettier, eslint e `node --check`.

## Pendências

- STALE não é derivável: `reconcile_billing_event` grava evento STALE com `processing_error` nulo (igual a APPLIED). Exigiria mudança aprovada na reconciliação.
- UI/server actions para consumir as RPCs.

## Definition of done

Critérios verdes no CI, revisão humana (RLS/billing) e `harness/feature_list.json` atualizado.
