# GOAL — stage-03c-public-commercial-flow: public signup and checkout

Status: done

Owner: agent

Created: 2026-10-06

Updated: 2026-10-06

## Objective

Implement only landing → safe live plan catalog → signup/login → existing server checkout → hosted checkout → owned persisted return → existing onboarding. Base main@8199ff2f3a7965ebc9ebf1184db30bd3b2af49c7; pulled once with clean tree and 3A/3B done/verified.

## Visible result

Public responsive Yas landing, Student-only signup with existing Profile trigger, preserved safe commercial continuation, protected checkout and persisted return. Redirect never confirms payment; canonical test uses an explicitly guarded local provider and authenticated webhook.

## Relevant context

AGENTS.md; docs/PRODUCT.md, BILLING.md, AUTH_RBAC_RLS.md, UI_CONTRACT.md and OPEN_QUESTIONS.md. Existing Auth routing, guards, UI primitives, 3A checkout and 3B reconciliation/Placement are authoritative.

## Acceptance criteria

- [x] Plans/prices projected from DB with no public Data API expansion.
- [x] Signup fixes STUDENT server-side, preserves confirmation/session flow and safely reports retryable role failure.
- [x] Auth continuation allows only exact commercial routes for Student.
- [x] Checkout enforces Student, live plan and existing commercial state, reusing startCheckout.
- [x] Return enforces ownership and PAID+ACTIVE+real Placement; result query has no authority.
- [x] Fake impossible in production; fake redirect never activates payment.
- [x] Focused unit/integration/E2E/a11y/responsive evidence and Official CI green before merge.

## Allowed files / domains

Public landing/signup/checkout/return and local fake surface; commercial application/server modules; exact Auth continuation additions; scoped styles; focused tests and local test-provider setup; 3C Harness records. The environment example documents the new required provider selector; a focused TypeScript config limits verification to this slice. Additive DB grants only if runtime proves a necessary invariant.

## Forbidden areas

3A/3B implementation and historical migrations, Admin/Teacher, Billing UI 3D, onboarding redesign, Notifications/Resend, Reports/Settings, upgrade/downgrade/recovery policy, general CSS/redesign and dependencies.

## Mandatory tests

User-authorized touched Prettier/ESLint, focused typecheck, auth/commercial units and signup/checkout integration, one canonical commercial E2E, focused landing/signup/return a11y and six responsive screenshots, git diff --check. SQL/RLS only if a genuinely necessary additive migration is added. No broad local suites; Official CI is broad release authority.

## Required evidence

harness/evidence/stage-03c-public-commercial-flow/ with commands/results, six screenshots and PR/CI links. Preserve 3A/3B and macro in_progress/verified:false.

## Definition of done

All acceptance criteria and required CI green, 3C done/verified, PR merged, main updated clean. Stop before 3D.
