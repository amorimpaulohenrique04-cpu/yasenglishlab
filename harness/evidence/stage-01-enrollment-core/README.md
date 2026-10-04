# Stage 01 — Enrollment Core: final verification

Branch: `feat/stage-01-enrollment-core`  
Base: `22b0562eaf308fabd363107feeecb639a126484e`  
Verified implementation head: `8e793d9678d080d813c1236e3090e3b063226ab7`  
PR: https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/pull/32

## Closure result

Stage 01 is verified. The Student can move through onboarding, the existing Assessment lifecycle, pending Teacher review, deterministic Placement, cohort choice and atomic enrollment. Teacher review remains protected by durable role scope + AAL2, Admin transfer remains audited/atomic, and the minimal Home projection only exposes the next relevant state.

No CEFR cut score was invented, no real Mux smoke is claimed, no Billing provider or notification delivery was added, and `p21-p1-core-experience` remains independently `in_progress / verified:false`.

## Mandatory aliases

Stage 01 Full Verify run: https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/actions/runs/37164246619

- `npm run verify:agent` — success
- `npm run verify:security` — success
- `npm run verify:db` — success
- `npm run verify:ui` — success
- `npm run verify:full` — success

The temporary workflow used only to execute these aliases on the implementation SHA was removed after the successful run.

## Official CI

Official CI #498 / run `37164246623`: https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/actions/runs/37164246623

- Supply Chain — success
- Quality — success
- Database — success
- Guardrail Simulations — success
- Preview — success
- CI Gate — success

Quality proved canonical format, lint, typecheck, unit/application integration, Harness, platform/security invariants and production build.

Database proved migration policy, clean replay, second clean replay and base-to-head upgrade with existing data.

Preview proved real DB integration, Placement concurrency, positive/negative RLS, observability, canonical fixture replay, Critical E2E, persistence/analytics, accessibility, Storybook, design-system visuals and product golden visuals.

Preview artifact: `11289301242`, `preview-evidence-c199aa8a9b639626c9c85e9a8cec8b7e9258cb1b`, digest `sha256:7ceb3d782e8aea4a11da81dc367f6145d8a3031874f2da61e81ee69f5f368d8f`.

## Stage 01 invariants re-proved

- Placement transitions and preferences are durable; recommendation remains immutable and the Student choice is separate.
- Existing Assessment is reused/resumed; answer keys, rubrics and scoring configuration are not exposed to the Student.
- Teacher review requires AAL2 and assignment/cohort scope; identical retries are idempotent and conflicting mutations are rejected.
- Cohort matching is deterministic across track, schedule, publication and capacity.
- Real two-connection last-seat proof permits one winner and rolls back the losing enrollment without partial membership.
- Admin enrollment projection and transfer preserve history and require authorization, compatibility, capacity and audit facts.
- Critical DML remains protected by RLS/RPC boundaries and negative permission tests.
- 15 durable screenshots cover onboarding, Assessment, Placement, Teacher review and Admin enrollments across desktop/tablet/mobile.

## Supply-chain remediation

GHSA-vfj7-8cjw-p6xm / CVE-2026-93687 had no patched npm release for `braces@3.0.3`. The final implementation does not lower `audit-level`, force-downgrade Next/ESLint or hide new advisories. It applies a source-reviewed depth guard backport to the dev-only installed package, verifies exact patch provenance/bytes and exploit boundary, requires the production dependency audit to be clean, and fails closed if any audit finding outside the exact patched advisory chain appears.

This is a temporary upstream compatibility remediation. Replace it with an official fixed dependency release when one becomes available; that maintenance item does not block the verified Stage 01 product behavior.

## Checklist

- [x] Supply-chain blocker resolved without weakening severity or production audit.
- [x] Stage 01 dependency boundary reconciled; P21/Mux remains independent and unverified.
- [x] Clean migrations, replay and main-to-head legacy upgrade passed.
- [x] RLS allow/deny, SQL invariants and real concurrency proof passed.
- [x] Student/Teacher/Admin browser journey passed.
- [x] Accessibility, Storybook and product visual gates passed.
- [x] Five literal mandatory aliases passed on the verified implementation SHA.
- [x] Official CI and CI Gate passed on the same implementation SHA.
- [x] Historical failure records preserved and Ratchet/Harness passed.
- [x] No merge to `main` was performed.
