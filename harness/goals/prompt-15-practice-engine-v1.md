# GOAL — prompt-15-practice-engine-v1: Deterministic Practice V1

Status: in_progress
Owner: agent
Created: 2026-09-30
Updated: 2026-09-30

## Objective

Deliver a release-grade Practice V1 in which a student can discover supported activities, understand a deterministic recommendation, start and submit an idempotent attempt, receive objective feedback only for deterministic answers, and review their own history without treating practice progress or results as course progress or CEFR proficiency.

## Visible result

`/pratica` follows the approved Practice reference: a dominant recommended action, skill catalog, recommended activities and recent history. Vocabulary and Grammar activities with contracted answer keys are playable and objectively scored. Listening without audio content is unsupported, while Speaking and Pronunciation remain explicitly pending/manual behind an evaluation port and never receive inferred scores.

## Relevant context

- `docs/PRODUCT.md`
- `docs/PRACTICE_ENGINE.md`
- `docs/DATA_MODEL.md`
- `docs/ARCHITECTURE.md`
- `docs/UI_CONTRACT.md`
- `docs/ACCESSIBILITY.md`
- `docs/ANALYTICS.md`
- `docs/TESTING.md`
- `docs/DEFINITION_OF_DONE.md`
- `docs/OPEN_QUESTIONS.md`
- `docs/reference-ui/pratica/`
- `supabase/migrations/20260929035100_create_domain_contracts.sql`
- `supabase/migrations/20260929043000_auth_rbac_rls.sql`

## Acceptance criteria

- [ ] The catalog exposes all five domain skills with availability derived from contracted content/evaluation support, not UI conditionals.
- [ ] Recommendation order and explanation are deterministic, centralized and covered by unit tests.
- [ ] Students can start and submit their own attempts idempotently; responses, results and history persist.
- [ ] Deterministic answers receive objective feedback; manual/pending activities receive no artificial score.
- [ ] Practice result/progress never mutates course progress or CEFR proficiency.
- [ ] RLS and authenticated RPCs prevent Student A from reading or mutating Student B's attempts, responses or results.
- [ ] `practice_started` and `practice_completed` are emitted idempotently and are not transactional sources of truth.
- [ ] Loading, empty, error and unsupported states are explicit and the UI is responsive/accessibility-checked against the approved reference.
- [ ] No unrelated behavior regressed.

## Allowed files / domains

- `src/app/(protected)/(student)/pratica/**`
- `src/modules/practice/**`
- `src/server/practice/**`
- `src/modules/learning/ui/student-shell.tsx` (Practice navigation only)
- `src/modules/domain/contracts.ts` (Practice contract refinements only)
- `supabase/migrations/**` (new Practice migration only)
- `supabase/seed.sql` (Practice content only)
- `supabase/tests/**` (Practice persistence/RLS assertions only)
- `tests/unit/**`, `tests/integration/**`, `tests/e2e/**`, `tests/a11y/**`, `tests/visual/**` (Practice coverage plus URL synchronization needed by the official a11y gate)
- `playwright.golden.config.ts`, `playwright.a11y.config.ts` (Practice coverage only)
- `scripts/run-sql-tests.mjs`, `scripts/setup-canonical-e2e.mjs`, `scripts/assert-canonical-e2e.mjs`, `scripts/verify-db.mjs` (Practice test wiring/invariants only)
- `scripts/verify-platform.mjs`, `harness/failure-log/2026-09-30-windows-playwright-cold-start-contention.md` (canonical E2E budget ratchet only)
- `docs/PRACTICE_ENGINE.md`, `docs/DATA_MODEL.md`, `docs/ANALYTICS.md` if executable contracts require synchronization
- `harness/**` for task state, evidence and registry
- `.env.local` (local UTF-8 BOM normalization only; no value changes or committed secret)

## Forbidden areas

- CEFR assessment/scoring or `skill_scores`
- Course progress semantics or lesson completion
- AI, fluency or pronunciation scoring
- Selecting a human/AI/hybrid Speaking or Pronunciation policy
- Analytics provider selection
- Unrelated product routes or design-system primitives

## Mandatory tests

- `npm run verify:agent`
- `npm run verify:ui`
- `npm run verify:security`
- `npm run verify:db`
- `npm run verify:full`
- Practice unit, integration, DB/RLS, E2E and a11y coverage

## Required evidence

- Exact command/check results under `harness/evidence/prompt-15-practice-engine-v1/`.
- Desktop, tablet and mobile Practice screenshots inspected against the approved reference.
- SQL evidence for idempotency and cross-student denial.
- Unit evidence for deterministic recommendation and evaluation boundaries.

## Definition of done

Done means every acceptance criterion passes, all mandatory checks pass, visual/security/database evidence is inspected, persistent state and the registry reflect reality, and any remaining provider/pedagogy decision stays explicitly pending rather than inferred.
