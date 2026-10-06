# ADR 0013 — Asaas billing provider

Status: accepted. Date: 2026-10-05. Authorized by Stage 03 master prompt.

## Decision
Use Asaas behind BillingProvider, server-only fetch, explicit sandbox/production environments. V1 hosted checkout uses CREDIT_CARD + RECURRENT, MONTHLY, BRL cents converted once to reais. Customer/card details are collected by Asaas; Yas does not store them. No SDK dependency.

## Verified capabilities and constraints
- [Sandbox](https://docs.asaas.com/docs/sandbox): independent accounts/keys; fixed API origins.
- [Recurring checkout](https://docs.asaas.com/docs/checkout-com-assinatura-recorrente): hosted card checkout with items, nextDueDate and MONTHLY cycle; examples express amounts in reais. Yas restricts its existing Plan currency to BRL.
- [Create checkout](https://docs.asaas.com/reference/criar-novo-checkout): CREDIT_CARD and PIX; boleto is absent from this endpoint. Pix recurring checkout is not assumed. [Payment links](https://docs.asaas.com/reference/criar-um-link-de-pagamentos) have boleto support but are not this adapter's contract.
- [Checkout redirect](https://docs.asaas.com/docs/link-do-checkout-e-redirecionamento-do-cliente): build hosted URL from checkout ID. Callback never confirms payment.
- [Webhooks](https://docs.asaas.com/docs/eventos-para-checkout): at least once, event-ID deduplication and asaas-access-token verification; future 3B owns financial reconciliation.
- [Cancel subscription](https://docs.asaas.com/reference/remove-subscription): DELETE stops recurrence and removes pending/overdue charges. Scheduling semantics require product policy; no cancellation UI in 3A.
- [Refund](https://docs.asaas.com/reference/estornar-cobranca) supports paid card/Pix refunds; [payment events](https://docs.asaas.com/docs/webhook-para-cobrancas) cover partial/full refunds and chargeback lifecycle. No refund policy/UI invented.
- [Duplicate checkout guidance](https://docs.asaas.com/docs/erros-comuns-e-boas-pr%C3%A1ticas): persist checkout ID and check before recreating; externalReference is correlation, not a documented POST idempotency guarantee.

## Durable creation boundary
Reserve one open session per Student under a transaction advisory lock, resolving active Plan price/name/currency in the database. Only the reservation winner calls the provider. READY links are reused until their conservative expiry. A CREATING session with an ambiguous provider or persistence failure is retained indefinitely pending reconciliation, never expired automatically or blindly retried. This favors avoiding duplicate charges over availability. No automatic HTTP retries.

Only service_role can reserve/complete or read sessions. The application input is a trusted authenticated identity, never a browser-supplied user ID. 3C must add the authenticated boundary and `/billing/return` consumer; 3A deliberately exports no public route. Completion means a hosted link exists, not payment success. Webhooks/Placement/entitlements remain 3B.

## Consequences
Minimal additive table records immutable historical Plan snapshot and correlation ID, no raw provider payload or payment instrument. Existing subscriptions/entitlements remain authoritative for access. Sandbox live homologation requires operator credentials; deterministic tests use injected fetch/fake and real SQL. Reconciliation of unknown outcomes is a prerequisite before public rollout.
