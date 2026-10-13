# GOAL — stage-04d-1: Cancelamento pelo aluno com acesso até o fim do período pago (SQL)

Status: in-review (SQL escrito, testes NÃO executados)  
Owner: agent/human  
Created: 2026-10-13  
Updated: 2026-10-13

## Objective

O aluno cancela pelo produto; o servidor cancela a assinatura no Asaas (sem renovar) e o aluno mantém acesso até o fim do ciclo já pago; depois aplica-se a suspensão do ADR 0016 (`CANCELLED` suspende). Mensalidade sem juros, ciclo mensal.

## Decisions

- Sem coluna nova. `subscriptions.current_period_end` guarda "acesso pago até" = `billing_last_cycle_date + 1 mês` (00:00 America/Recife, nunca antes de agora; sem ciclo registrado = agora). `cancel_at_period_end` é só o marcador enquanto `ACTIVE`.
- Motivo: `reconcile_billing_event` (efeito CANCELLED) zera `cancel_at_period_end` e define `ended_at`, mas nunca escreve `current_period_*`; logo `current_period_end` sobrevive ao webhook `SUBSCRIPTION_DELETED`. O reconciler não foi alterado.
- `private.has_paid_access`: `CANCELLED` com `current_period_end > now()` conta como pago. `PAST_DUE`/`EXPIRED` continuam suspensos. `private.entitlement_limit` e `private.booking_entitlement` seguem a mesma regra (senão o aluno perderia conteúdo/reservas com chave de entitlement).
- RPCs (`authenticated`, só `auth.uid()`, exigem STUDENT): `request_subscription_cancellation()` (idempotente, auditada) e `revert_subscription_cancellation_request()` (só enquanto `ACTIVE`).

## Relevant context

- `docs/adr/0016-access-suspension-on-payment-failure.md`
- `supabase/migrations/20261013140000_stage_04d_subscription_cancellation.sql`
- `supabase/tests/subscription_cancellation.sql` (`node scripts/run-sql-tests.mjs subscription-cancellation`)

## Acceptance criteria

- [ ] Cancelar `ACTIVE` próprio grava marcador + data; repetir não muda a data nem audita de novo.
- [ ] Outro usuário, staff, anon, sem assinatura e `PAST_DUE` são negados.
- [ ] `CANCELLED` com data futura mantém material/asset/reserva; com data passada suspende.
- [ ] Revert restaura o estado anterior; não reverte linha já `CANCELLED`.
- [ ] Nenhuma migration aplicada editada; `reconcile_billing_event` intocado.

## Forbidden areas

`reconcile_billing_event`, Etapa 3; camada TS/UI (próximo agente).

## Mandatory tests

`npm run verify:db`, `npm run verify:security` (passaram localmente, estáticos); suítes SQL `integration` e `subscription-cancellation` rodam só no CI/Docker (NOT RUN).

## Pendências / riscos

- `CANCELLED` com `current_period_end` futuro concede acesso por qualquer origem; hoje só esta RPC escreve esse campo.
- Revert zera `current_period_end` (valor anterior sempre nulo hoje).
- Aluno pode chamar as RPCs direto: efeito limitado ao próprio marcador; o status só muda pelo webhook.
- Reservas futuras em `CANCELLED` após o fim do acesso (ADR 0016 d.4) ainda não são liberadas.
