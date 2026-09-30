# Progress Log

Append-only task milestones. Do not rewrite history to hide failed attempts.

## 2026-09-30 — prompt-13-learning-core

- Started from clean `main` tracking `origin/main`; created `harness/goals/prompt-13-learning-core.md` and marked the registry entry `in_progress` / unverified before runtime changes.
- Read the required data, UI, design, accessibility, testing, analytics and open-question contracts; inspected the approved 1400×788 Aulas reference and the current learning routes, domain, ports, adapters, migrations and tests.
- Audit confirmed that `courses.active` is the existing publication boundary inherited by modules/lessons, progress ownership already derives from auth context through `record_lesson_progress`, and no video provider or `VideoPlaybackPort` is needed.
- Gaps found: courses lack an explicit query order; stale checkpoints can reduce `last_position_seconds`; lesson UI lacks previous/next and a dedicated content-empty state; refresh/retry can duplicate learning analytics; `module_completed` is not emitted.
- Minimum plan recorded in `harness/agent-state/plan.md`; implementation remains pending and no verification claim has been made.

## 2026-09-30 — pre-p13-environment-gate

- Started on branch `fix/windows-development-environment` at `a936fb0` with pre-existing untracked `supabase/config.toml` and `supabase/.gitignore`; both are preserved pending review.
- Initial audit confirmed Node 24.19.0, npm 11.17.0 through `npm.cmd`, Docker CLI 29.8.1, a stopped Docker daemon, PowerShell execution-policy interception of `npm.ps1`/`npx.ps1`, Supabase installed through Scoop but absent from the process PATH, and no discoverable `psql` yet.
- Scope excludes Prompt 13, product behavior, production Supabase and any weakening of tests/security/RLS.
- First complete local gate passed after isolating Supabase on ports 55320–55329, repairing a corrupt cached `postgres-meta:v0.99.0` image, serializing the Windows E2E cold start and separating Linux/Windows golden rasterization baselines without changing visual tolerance.
- Windows login/home/aulas baselines for desktop, tablet and mobile were inspected directly before the first successful `npm run verify:full`.
- Final clean-room proof stopped the Yas stack without backup, restarted it, rebuilt migrations and seed, passed direct `verify:ui`, then passed `npm run verify:full` with exit code 0 and stopped the stack again.
- Final full-gate counts: DB integration 2 SQL files, RLS 1 SQL file, E2E 2/2, accessibility 4/4, Storybook visual 6/6 and golden regression 3/3.
- Sanitized evidence was persisted under `harness/evidence/pre-p13-environment-gate/`; the task registry moved to `done` and `verified: true` only after the successful clean-room run.

## 2026-09-28 — prompt-03-harness-engineering

- Started from main commit `4911b389a48219a5e4d00bdac969fff5fc9de462`.
- Scope limited to harness, verification scripts, package commands and CI wiring.
- Product features explicitly excluded.
- Verification pending; feature registry remains `in_progress` until evidence exists.
- First clean CI run failed only at canonical formatting; remediation delegated to the pinned Prettier before re-running the same checks.
- Canonical formatting applied using the pinned Prettier.
- Clean CI run 36510847571 passed foundation, harness, security, DB, Storybook and Playwright checks.
- Evidence inspected and persisted under `harness/evidence/prompt-03-harness-engineering/`.
- Registry updated to `done` + `verified: true` only after the successful run.
- Final read-only CI run 36511078068 passed with `npm ci`, `contents: read`, no formatting mutation and all harness/UI checks green.

## 2026-09-28 — prompt-04-design-system

- Started from main commit `f85c54a7decd2a929e3238c675e5269558b15683`.
- Read UI_CONTRACT, DESIGN_SYSTEM, ACCESSIBILITY and approved reference manifest.
- Inspected login, home, materiais and progresso approved screenshots directly from `docs/reference-ui/`.
- Existing component audit found only foundation placeholders; no real primitive exists to reuse yet.
- Scope excludes complete product pages and product-domain behavior.

- Implemented required token categories: colors, typography, spacing, radius, shadow, border, breakpoints, z-index and motion.
- Implemented the approved recurring UI/layout primitive inventory without product pages.
- Initial strict TypeScript verification caught optional-property/index-access errors; fixed without weakening compiler settings.
- Initial Axe run caught invalid Avatar ARIA semantics; fixed by giving the labelled Avatar valid image semantics instead of suppressing the rule.
- Visual test viewport handling was tightened so evidence is captured at explicit desktop/form/mobile dimensions.
- Read-only CI run 36515649247 passed foundation, harness, security, DB, Storybook, app E2E and all 6 design-system visual/a11y/keyboard tests.
- Inspected the four generated screenshots: core states, form validation, desktop shell and 390×844 mobile shell. They preserve the approved purple/light-lilac/white/yellow hierarchy without implementing a product page.
- Feature registry remains `in_progress` until the final current-action CI gate is green.

- Final current-action read-only run 36517734330 passed after upgrading visual evidence upload to `actions/upload-artifact@v7`.
- Final screenshot artifact 11012210130 uploaded successfully; digest `sha256:f3b9b3383a4503dd5007863d5d0620d66b17a6ab5c752cdb86c8ecc4babb35a1`.
- Registry changed to `done` + `verified: true` only after the green run and visual inspection.
- Active plan closed; no product page or product-domain implementation was introduced.

## 2026-09-29 — prompt-10-observability

- Started from main commit `a3fb43eb606779f8ba6c5f29ef5564a72c41c082`.
- Read ANALYTICS, OBSERVABILITY, SECURITY, ARCHITECTURE and OPEN_QUESTIONS before implementation.
- Preserved the open provider decisions for product analytics and error reporting/tracing.
- Expanded product analytics taxonomy while keeping `ProductAnalyticsPort` as the application boundary.
- Added request/trace/span correlation, structured logs, privacy sanitizer, typed error codes and provider-neutral `ObservabilitySink`.
- Added append-only `observability_events` bootstrap sink and request/environment/version fields to audit logs.
- Instrumented authorization denials, booking, protected asset access, role change, analytics persistence and audit persistence.
- Added the intentional-error live test to Preview CI; verification is still pending, so registry remains `in_progress`.

- Official CI run 36640424406 passed Supply Chain, Database, Guardrail Simulations, Quality, Preview and CI Gate on branch head `fcbfddc1864fa328b48334f0ba960d6a58934c32`.
- Preview intentionally emitted and persisted `database_error` at `ci.intentional_error`; the result was queried by the same `request_id` and written to artifact 11066198006.
- Artifact `artifacts/observability/intentional-error.json` was downloaded and inspected directly; correlation IDs, stage, impact, environment and exact preview version were present.
- Evidence inspection caught and fixed two privacy-sanitizer false positives before completion: ISO timestamps and numeric runs inside alphanumeric release SHAs.
- Final structured log uses snake_case correlation fields, omits absent user identity, preserves ISO timestamp/version, and retains redaction for actual sensitive values.
- Durable evidence recorded under `harness/evidence/prompt-10-observability/`.
- Registry moved to `done` + `verified: true` only after the green run and evidence inspection.

## 2026-09-29 — prompt-11-ratchet-adrs

- Started from main commit `218a62872cbc00e8a71e43af3a746a3307536655`.
- Audited the existing harness and found `docs/adr/` and `harness/failure-log/` already present, so PROMPT 11 extends those sources instead of creating duplicate process trees.
- Identified a real harness gap: a repeatable failure could be recorded/resolved without mandatory root cause, permanent protection, test/eval or red-to-green proof.
- Implemented the failure-to-guard contract, ADR template, failure classification schema, periodic harness-review process and executable ratchet verifier.
- Added a controlled red fixture that must be rejected when permanent protection/test are absent and a corrected green fixture that must pass.
- Wired `npm run verify:ratchet` into the existing Harness invariants gate used by Official CI.
- Verification is pending; feature remains `in_progress` and `verified: false` until Official CI is green.

- Official CI run 36653227178 passed Supply Chain, Database, Guardrail Simulations, Quality, Preview and CI Gate on implementation head `06a8c20b7b46e0604f8119a63ba93e4640f55d71`.
- The Harness invariants log proved the controlled ratchet cycle: red fixture rejected, green fixture accepted and 1 durable failure record verified.
- Durable verification evidence was persisted under `harness/evidence/prompt-11-ratchet-adrs/`.
- Feature registry moved to `done` + `verified: true` only after the green Official CI run.

## 2026-09-29 — prompt-12-engineering-system-1-0

- Audited the current `main` independently from prior completion claims.
- Found stale entry-point documentation, stale persistent plan state, missing engineering milestones in the registry and an incomplete local `verify:ui` gate.
- Corrected documentation/state without changing product behavior, runtime code, DB schema, RLS or approved UI.
- Added `scripts/verify-engineering-system.mjs` with controlled stale-state and incomplete-UI red→green fixtures.
- Expanded `verify:ui` so the local official UI gate runs E2E, critical-flow a11y, Storybook visual checks and product golden regression.
- Added two durable Ratchet incidents; `verify:ratchet` now validates 3 durable failure records.
- Initial Official CI run failed only canonical formatting in two new/updated files; formatting was corrected without changing behavior.
- Official CI run 36657346038 passed Supply Chain, Guardrail Simulations, Quality, Database, Preview and CI Gate on branch head `a49327f03b3d9726b5da02a2775734af181cb874`.
- Quality proved: Engineering System 1.0 contract valid, Harness 24 required paths / 11 registry entries, security boundary valid across 77 source files.
- Preview proved isolated Supabase, intentional observability error, canonical E2E, persistence/analytics, accessibility, Storybook visual and product golden visual checks.
- Preview artifact 11073276378 was uploaded with digest `sha256:70e3640fbd4765300238556bc7327a03cc18d5fff0b173255407ed365778526d`.
- Durable evidence stored under `harness/evidence/prompt-12-engineering-system-1-0/`.
- Registry moved to `done` + `verified: true` only after the green implementation run.

## 2026-09-30 — windows-local-tooling

- Audited all pre-existing local changes before implementation: temporary Windows runner fixes in four scripts, Next.js 16.3.6 `tsconfig.json` changes, and generated `tsconfig.tsbuildinfo`.
- Confirmed the same unnecessary-shell class in SQL verification and Supabase cleanup; the remaining scripts use direct native execution and did not require changes.
- Added the repository LF policy, direct Node/npm CLI dispatch, native no-shell execution and a controlled cross-platform regression verifier.
- Inspected the installed Next.js 16.3.6 configuration writer and retained its required React JSX runtime plus dev/build generated-type includes.
- Initial `npm run verify:platform` passed on Windows: controlled red fixture rejected, corrected Windows fixture accepted, real path-with-spaces arguments preserved, 16 Node scripts audited and LF attributes enforced.
- Expanded the permanent audit to all 19 Node scripts under `scripts/` and added a Linux invocation fixture; an initial Windows path-separator bug in the recursive verifier was caught immediately and corrected before final gates.
- `format:check`, lint, typecheck, unit (20/20), integration (6 passed, 1 pre-existing live test skipped), harness, security and `verify:agent` all passed without DEP0190.
- `verify:full` was not run: Supabase CLI and `psql` are missing from PATH, Playwright Chromium is absent, and Docker config access was denied despite Docker CLI 29.7.2 being installed. Exact evidence is stored under `harness/evidence/windows-local-tooling/`.
- Registry moved to `done` + `verified: true` after evidence inspection; no product, UI, DB, migration, RLS, auth, domain, provider or golden change was made.

## 2026-09-30 — prompt-13-learning-core closure

- Implementation is complete at commit `1adb44e5ca75860d261da1afd6de1d50d1e68f15`; this closure task did not alter product behavior.
- Official CI run `36756026206` for that SHA completed with conclusion `success`; Release run `36756622829` also completed with conclusion `success`.
- Database evidence was inspected: migration policy passed for 5 migrations, clean-database validation/replay passed, and `20260930172100_harden_learning_progress_analytics.sql` was applied in the isolated Preview stack.
- Executable SQL evidence was inspected: `supabase/tests/rls_permissions.sql` and `supabase/tests/vertical_slice_persistence.sql` ran successfully, including draft visibility/authorization and monotonic persistence/idempotency assertions.
- Canonical E2E passed 2/2 for the learning flow, including logout/login persisted resume; the post-E2E persistence/analytics assertion printed `Canonical E2E persistence and analytics evidence passed.`.
- Accessibility passed 4/4; product golden visual checks passed 3/3 across desktop, tablet and mobile; the uploaded Preview evidence artifact was inspected.
- Durable evidence was added under `harness/evidence/prompt-13-learning-core/`.
- `harness/feature_list.json` moved `prompt-13-learning-core` to `done` with `verified: true`; the active plan was closed without starting P14.

## 2026-09-30 — prompt-13-learning-core closure verification

- The first P13.1 state-only closure commit was corrected only for canonical Prettier formatting; no product file was touched.
- Finalized closure state at `5386a477591bedb78642048747e9ea93ceb45ce0` passed Official CI run `36758655475`: Supply Chain, Quality, Guardrail Simulations, Database, Preview and CI Gate all completed with conclusion `success`.
- Quality passed `npm run format:check`, lint, typecheck, unit, integration, Harness invariants, security invariants and production build.
- Preview re-proved the canonical E2E, persistence/analytics assertion, accessibility, Storybook/design-system visual checks and product golden visual checks on the closure state.
- Preview artifact `11117713607` was uploaded with digest `sha256:86c9145c48f69eb8eeac41d7901f4ebbef6a05c7db75034c84d74a0e6dab9380`.
- Behavioral-eval contract inspection requires durable verification to declare `status: "passed"`; the P13 verification record was normalized accordingly.
- P13 remains `done` + `verified: true`; no P14 planning or functional change was introduced.

## 2026-09-30 — prompt-14-materials-v1

- Started from `main` at `849c23b519ccca59b18a08dec676a3cf02726f21` after Prompt 13 closure.
- Read Product, Materials, data, architecture, security/RLS, UI, accessibility, analytics, testing, open-question and approved Materiais visual contracts before product changes.
- Audit confirmed existing `materials` + `material_favorites`, RLS authorization by active material/enrollment/entitlement, private `yas-protected-assets`, server-only signed URL service and analytics taxonomy already cover the core V1 boundaries.
- Existing Data API grants intentionally omit `materials.storage_path`; current RLS tests already assert protected storage paths are not selectable by authenticated users.
- No DB/RLS change is currently required. Favorite idempotency can be implemented through existing unique ownership plus insert-conflict handling/delete semantics under RLS.
- Recents is intentionally excluded from V1 because there is no durable material-access history model and product analytics is explicitly not a system of record.
- Implementation and verification remain pending; no success claim has been made.
