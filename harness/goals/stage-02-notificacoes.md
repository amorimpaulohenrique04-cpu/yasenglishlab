# GOAL — stage-02-notificacoes: Notificações corretas e ligadas

Status: in-review

Owner: agent

Created: 2026-10-12

Updated: 2026-10-12

## Objective

Um pagamento gera uma única notificação/e-mail (Asaas CONFIRMED e RECEIVED não duplicam), renovações têm copy própria, e o processor de entrega passa a ter um chamador autenticado.

## Visible result

Uma notificação por pagamento+ciclo; ciclo seguinte exibe "Pagamento da renovação confirmado"; `GET`/`POST /api/cron/notifications` com Bearer drena o outbox e devolve só contagens.

## Relevant context

ADR 0014, `docs/BILLING.md`, migration 03e (imutável), `src/server/notifications/processor.ts`, `docs/OPERATIONS.md`.

## Acceptance criteria

- [x] Migration aditiva `20261012120000_stage_02_notification_payment_dedupe.sql`: dedupe por paymentId+cycleDate+tipo; renovação por notificação anterior da assinatura; só evento APPLIED.
- [x] Rota cron: 401 sem/errado/tamanho diferente, 503 sem configuração, 200 só com contagens; secret server-only comparado com `timingSafeEqual`.
- [x] Testes: integração do handler (executado); SQL em `supabase/tests/notification_delivery.sql` (escrito, NÃO executado — sem Docker).
- [ ] SQL executado em DB local/CI; hosting do agendador decidido (OPEN_QUESTIONS).

## Allowed files / domains

Notificações (módulo, server, rota cron), `src/server/env.ts`, `.env.example`, nova migration, testes, OPERATIONS.

## Forbidden areas

`reconcile_billing_event`, migration 03e, ADR 0014, deploy/migration remota/cobrança externa.

## Mandatory tests

- `npx vitest run tests/integration/notifications-cron.test.ts`
- `npm run verify:security`
- `npm run verify:db` (pendente: requer Docker)

## Required evidence

Saída dos comandos acima; execução SQL pendente.

## Definition of done

Critérios marcados com comando executado; SQL passa em DB local antes do merge; revisão humana (billing/segurança/migration).
