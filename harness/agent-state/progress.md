# Progress Log

Append-only task milestones. Do not rewrite history to hide failed attempts.

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
