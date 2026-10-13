# Admin Content V1 — discovery evidence

2026-10-01. Discovery started blocked. The product owner subsequently resolved that contract explicitly; the implementation and focused local verification below supersede the blocked conclusion. Registry stays `in_progress/verified:false` only because Official CI evidence for the final head is not attached.

Two read-only agents investigated content/Student contracts and Admin/auth/audit/tests. Principal reviewed schema, Student learning repository, content RLS, Admin guard/service and audit taxonomy. No runtime files changed.

## Principal synthesis

- **JÁ EXISTE:** courses → modules → lessons → lesson_assets; materials; practice_activities; parent FKs; positive unique positions within modules/lessons/assets parents; active availability; Student repositories; private storage/signed URLs; durable ADMIN + AAL2; append-only sanitized audit; shared UI primitives.
- **FALTA:** Admin Content routes/CRUD; content mutation/audit boundary; publication contract/gate; isolated draft preview; atomic reorder; Admin Content DB/E2E tests.
- **NÃO CRIAR:** mirror CMS tables, new practice engine, assessment authoring, implicit staff permissions, review queues/approvals.
- **DECISÕES HIGH:** publication versus open pedagogical review; draft visibility and edits to published content; RLS/grants and transactional audit; Student compatibility. No new decision inferred.
- **BLOQUEADORES:** docs/OPEN_QUESTIONS.md leaves pedagogical review before publishing lesson/material/practice open. No durable contract authorizes direct draft → published while that decision remains open. active controls availability, not a documented editorial publication workflow. modules/lessons/assets lack individual draft/published state.
- **PATCH MÍNIMO:** Harness goal/evidence/blocker, registry and plan/progress only.

## Objective findings

- supabase/migrations/20260929035100_create_domain_contracts.sql defines the existing entities; assessment_versions has an unrelated DRAFT/PUBLISHED contract, outside scope.
- supabase/migrations/20260929043000_auth_rbac_rls.sql grants authenticated content SELECT, not DML. Module/lesson visibility inherits active course; Admin AAL2 has privileged reads.
- src/server/learning/supabase-learning-repository.ts reads active enrolled courses and persistent positions, without editorial publication states.
- src/server/auth/guards.ts requires durable role and staff AAL2. src/server/auth/admin.ts administers roles, not content publication.
- src/server/audit/actions.ts has no content create/update/publish/unpublish/reorder taxonomy.

## Safe independent implementation assessment

Editing existing visible rows immediately changes Student content. Treating active as an editorial state or adding draft publication would decide the open contract. The requested editable draft → preview → publish flow cannot be delivered independently. A read-only inventory would not satisfy the requested feature; no unrelated UI was added.

## Required contract resolution

Explicitly document whether ADMIN may publish directly in V1 while review is deferred, the unit of draft/publication and the behavior of edits to published content. Do not invent reviewer roles, approvals or pedagogical criteria. OPEN_QUESTIONS remains unchanged.

## Verification

- node node_modules/vitest/vitest.mjs run tests/unit/security-contracts.test.ts — passed, 3/3 tests. Confirms existing staff AAL2 rules, not new Admin Content behavior.
- node scripts/verify-harness.mjs — initial run rejected the blocker record because it lacked the required failure-log template fields; corrected the record, then reran successfully (ratchet, system, platform and registry checks).
- No Admin Content runtime, database or browser check is claimed. verify:agent, verify:security, verify:db, verify:ui and verify:full were not run for this blocked documentation-only phase.

## Implementation evidence — 2026-10-01

The explicit owner decision is recorded in `docs/ADMIN_CONTENT.md` and ADR 0006: durable ADMIN at AAL2 can transition existing content directly between DRAFT and PUBLISHED; `active` remains operational availability; published content must return to DRAFT before it can change; no pedagogical review workflow was added.

- Reused `courses`, `modules`, `lessons`, `lesson_assets`, `materials`, and `practice_activities`; no mirror CMS table or alternate Student projection exists.
- The append-only migration adds publication state and effective-publication RLS. It provides narrow ADMIN+AAL2 commands for list/save/transition/reorder, fixed field allowlists, `auth.uid()` audit attribution, no authenticated direct content DML, and a fixed `search_path` on privileged functions.
- Publication validates only documented structural invariants. Student repositories and practice/progress RPCs now require effective publication through ancestors. Admin preview reads the same record under the existing Admin boundary and does not mutate visibility.
- The Admin UI uses existing application primitives and makes draft, preview, publish/unpublish, and deterministic parent-scoped reorder explicit. Binary upload remains deliberately unavailable.

### Executed focused verification

- `supabase db reset --local` — passed: all nine migrations and canonical seed replayed.
- `node "C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js" run test:integration:db` — passed: six SQL suites, including `supabase/tests/admin_content.sql`, and real Agenda concurrency.
- `node "C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js" run test:rls` — passed: three real RLS suites, including Admin Content draft/direct-ID/role/AAL2 isolation.
- `node harness/evidence/prompt-18-admin-content-v1/run-local-checks.mjs verify:security` — passed.
- Focused Admin Content unit/application tests — passed: 9 tests. The wider unit suite passed 41 tests and the wider application suite passed 28 tests plus one pre-existing skip during the interrupted aggregate gate.
- `node harness/evidence/prompt-18-admin-content-v1/run-local-checks.mjs admin-e2e` — passed: 1/1 in 40.1s. It exercised real Admin MFA, draft preview, Student invisibility, publish, reorder, unpublish and reload persistence.
- `node harness/evidence/prompt-18-admin-content-v1/run-local-checks.mjs admin-a11y` — passed: 2/2 in 29.8s, at desktop and mobile viewports, including keyboard focus and axe WCAG A/AA checks.

Desktop preview evidence is [module-draft-preview.png](../../../artifacts/prompt-18-admin-content/module-draft-preview.png); the Student publication/unpublication captures are adjacent.

### Superseded note (reconciled 2026-10-12)

The earlier "pending" statement about `tests/e2e/admin-content.spec.ts` and the Admin accessibility case in `tests/a11y/critical-flows.spec.ts` is superseded by the `admin-e2e` (1/1) and `admin-a11y` (2/2) local passes listed above. What remains is Official CI evidence (run link) before promotion to `done/verified`. The full gates are intentionally not run in this turn at the operator's direction.

## Closure by Official CI (2026-10-13)

Official CI run [38465500668](https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/actions/runs/38465500668) on `main` passed every mandatory job: Supply Chain, Quality, Database, Guardrail Simulations and the four Preview suites. The Critical E2E suite passed 33/33 (it includes `tests/e2e/admin-content.spec.ts`), the Accessibility suite passed 30/30 (it includes the Admin Content cases at desktop and mobile) and the SQL suites include `supabase/tests/admin_content.sql`. No skipped or retried-until-green test is recorded in that run. This supersedes the earlier "pending Official CI" statement; the item is `done/verified`.
