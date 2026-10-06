# GOAL — stage-03a-billing-provider-foundation

Status: done
Owner: agent
Created: 2026-10-05
Updated: 2026-10-05

## Objective

Implement only 3A: reversible Asaas hosted monthly checkout foundation, safe configuration, durable reservation and fake-provider tests.

## Visible result

Small independent PR based on main@28efe6a0d94a875e8ad58299116997f49d9d761b. No public checkout route yet.

## Relevant context

AGENTS.md; docs/BILLING.md; docs/ARCHITECTURE.md; docs/DATA_MODEL.md; docs/OPEN_QUESTIONS.md; ADR 0013; official Asaas checkout reference.

## Acceptance criteria

- Provider port, server-only Asaas adapter and fake implement monthly BRL checkout.
- Server resolves Plan and reserves immutable price snapshot before provider call.
- Concurrent calls reuse a checkout or remain pending; ambiguous failure never blindly retries.
- No browser secrets, arbitrary callback URLs, card data or financial-state mutations.
- Focused checks and PR/CI evidence recorded honestly.

## Allowed files / domains

src/modules/billing/application/**; src/server/billing/**; tests/helpers/fake-billing*; tests/integration/billing*; additive checkout migration and SQL test; .env.example; docs/BILLING.md; docs/OPEN_QUESTIONS.md; docs/adr/0013*; harness state, goals, registry and evidence; focused SQL test runner/CI registration if necessary.

## Forbidden areas

Webhook, Placement, landing, signup, Billing UI, notification delivery, existing migrations, unrelated UI/auth/domain changes.

## Mandatory tests

Changed-file Prettier/ESLint; typecheck; focused provider/fake integration; focused SQL/RLS. User's package policy overrides broad template gates: no verify:full or broad UI/agent suites.

## Required evidence

Commands/results, baseline, limitations, PR and known CI result under harness/evidence/stage-03a-billing-provider-foundation/.

## Definition of done

Acceptance criteria, focused checks, durable evidence, commit/push/PR and observed CI. Macro remains in_progress until 3F.
