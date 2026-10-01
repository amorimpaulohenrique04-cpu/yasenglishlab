# Prompt 19 — Assessment Engine V1 evidence

Status: passed — implementation, security, database and Official CI evidence inspected.

Baseline: `main@af0857d79345db9ed02f8624868c6b061cc71d0f`  
Branch: `feat/p19-assessment-engine-v1`  
Pull request: https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/pull/23  
Verified implementation head: `31e49149fe6f2fb73f307d2fedc70db21608f5bd`

PR #23 remains open and unmerged.

## Implemented evidence surfaces

- Domain/application: `src/modules/assessments/**`
- Authenticated server boundary: `src/server/assessments/**`
- Append-only migration: `supabase/migrations/20261001190000_assessment_engine_v1.sql`
- Real DB/RLS proof: `supabase/tests/assessment_engine.sql`
- Unit proof: `tests/unit/assessments.test.ts`
- Application integration proof: `tests/integration/assessment-application.test.ts`
- DB/RLS runner wiring: `scripts/run-sql-tests.mjs`
- DB contract verifier wiring: `scripts/verify-db.mjs`

## Contract and security evidence

Executable tests and the reviewed migration prove:

- Attempt start derives Student identity from `auth.uid()`, requires the durable STUDENT role and a PUBLISHED allowed version, and is idempotent by user + idempotency key.
- The AssessmentVersion bound to an attempt cannot change after creation.
- Response writes require owner, IN_PROGRESS attempt state, same-version item identity and the contracted server-side payload shape.
- Completion is retry-safe and does not duplicate SkillScores.
- Only contracted deterministic multiple-choice items receive automatic binary scores.
- Manual text, Speaking and Pronunciation remain pending/manual; unsupported semantics are not converted into zero or synthetic scores.
- `result_cefr` and `skill_scores.cefr_level` remain NULL; no percentage-to-CEFR mapping was introduced.
- Authenticated Data API access no longer exposes `assessment_items.answer_key`, `assessment_items.rubric` or `assessment_versions.scoring_config`.
- Cross-Student attempt/response/score access and mutation are denied.
- Direct authenticated DML on attempts, responses and SkillScores is denied; lifecycle writes go through narrow authenticated RPCs.
- The SECURITY DEFINER RPCs use an empty search path and explicit relation qualification.
- Published/used AssessmentVersion and item immutability remain enforced.
- Assessment analytics use the existing ProductAnalyticsPort with stable attempt-based idempotency keys.

## Official CI

Final implementation verification:

- Official CI: https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/actions/runs/36926422998
- Run number: `319`
- Head: `31e49149fe6f2fb73f307d2fedc70db21608f5bd`
- Conclusion: `success`
- Supply Chain: success
- Quality: success
- Database: success
- Guardrail Simulations: success
- Preview: success
- CI Gate: success

Observed Quality evidence:

- Prettier: all matched files formatted.
- Lint: success.
- Typecheck: success.
- Unit: 12 files / 47 tests passed; `tests/unit/assessments.test.ts` passed 6/6.
- Application integration: 8 files passed, 1 intentional live test skipped; 32 tests passed, 1 skipped. `tests/integration/assessment-application.test.ts` passed 4/4.
- Harness invariants: success.
- Security invariants: success across 152 source files.
- Production build: success.

Observed database/Preview evidence:

- Migration policy passed for 10 migrations.
- Clean migration validation passed twice, including `20261001190000_assessment_engine_v1.sql`.
- `supabase/tests/assessment_engine.sql` executed in clean database validation.
- Preview DB reset applied the P19 migration successfully.
- Integration SQL suite passed 7 files and explicitly executed `assessment_engine.sql`.
- RLS SQL suite passed 4 files and explicitly executed `assessment_engine.sql`.
- Critical E2E: 6/6 passed.
- Persistence/analytics postcondition: passed.
- Accessibility: 14/14 passed.
- Storybook build: passed.
- Design-system visual checks: 6/6 passed.
- Product golden visual checks: 3/3 passed.

## Verification history

The closure remained fail-closed:

- Earlier Official CI runs stopped at canonical formatting in `tests/unit/assessments.test.ts`; later gates were not treated as passed while skipped.
- A temporary diagnostic Format step ran the repository-pinned Prettier against the file and printed the exact diff.
- The exact Prettier output was applied, and the official workflow was restored before final verification.
- Run #319 is the first final run after restoration with every mandatory CI job green.
- No test, assertion, RLS rule, security gate, visual tolerance or product invariant was weakened to obtain the pass.

## Scope audit

P19 remains Assessment Engine only. It does not add Progress UI, Assessment Authoring/CMS, a new analytics provider, retake policy, CEFR cut scores/standard setting, or automatic Speaking/Pronunciation scoring. Historical migrations were not edited.

Open pedagogical decisions remain open rather than being silently encoded.

## Closure

Assessment Engine V1 is verified. Durable structured closure record: `harness/evidence/prompt-19-assessment-engine-v1/verification.json`.
