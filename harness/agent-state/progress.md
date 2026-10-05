# Progress Log

Append-only task milestones. Do not rewrite history to hide failed attempts.

## 2026-10-04 — stage-02-1-operations-ux started

- Confirmed GitHub `main` advanced to merge commit `f7ca51a5c0b2bb74b4e620d298454c93ab426b21`, containing Stage 02 PR #33; created `feat/stage-02-1-operations-ux` from that base.
- Preserved existing untracked `artifacts/canonical-slice/*` and `artifacts/p21-foundation/` without modification.
- Registered `stage-02-1-operations-ux` as `in_progress` / `verified:false`; reconciled the Stage 02 GOAL from `in_progress` to its registry's already-verified `done` state.
- Implementation and verification have not started; current checks and design/domain discovery remain pending.

## 2026-10-01 — Admin Content V1 discovery

Two read-only investigations and principal synthesis completed. Existing entities, Student consumers, ordering constraints, Admin+AAL2 and audit infrastructure mapped. Admin Content does not exist. Publication blocked by the open pedagogical-review decision and absent durable draft/publication contract. No runtime/migrations changed. Registry remains blocked and unverified; check results belong in P18 evidence.

## 2026-09-30 — prompt-15-practice-engine-v1

- Started from clean `main` at `038f63ad3f36ee114ddf96e89c30d7f7ab637c10` after the verified PRE-P15 gate.
- Read the required product, Practice, data, architecture, UI, accessibility, analytics, testing, open-question and approved visual-reference contracts.
- Inspected the existing Practice tables/RLS, canonical learning/materials slices, analytics port, Next.js 16.3.6 local documentation and current Supabase breaking-change feed.
- Confirmed that the open Speaking/Pronunciation evaluation policy must remain behind a pending/manual port and that no practice signal may write course progress, `skill_scores` or inferred CEFR.
- Gap audit found no Practice application/UI slice, no persisted response entity, no authenticated mutation RPC, no idempotency contract, no seeded contracted activity content and no Practice-specific verification.
- Registered the P15 goal and minimum plan before runtime code changes; implementation and verification remain pending.
- The first Supabase status check exposed a pre-existing UTF-8 BOM in ignored `.env.local`; the current CLI rejects it before reading `supabase/config.toml`. Scope was expanded only to normalize that encoding without reading or changing environment values.

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

## 2026-09-30 — prompt-14-materials-v1 implementation

- Added a dedicated Materials domain/application boundary and server-only Supabase repository that reads only Data API columns already granted to authenticated users; `storage_path` is never selected by the feature.
- Added `/materiais` with deterministic search/category filters, module/lesson context, favorites, loading/empty/error/unauthorized states and responsive composition based on the approved reference.
- Favorite writes stay on the authenticated RLS client. Duplicate inserts are treated as the same desired state through the existing unique constraint; delete is naturally idempotent.
- Protected opens use an internal GET route with no Next prefetch, re-authorize the material, call the existing short signed-URL service and emit minimized `material_opened` analytics only after signing succeeds.
- Added deterministic material metadata to the development seed. No public material URL was introduced.
- No migration or RLS change was required; existing negative SQL evidence for entitlement denial and protected `storage_path` remains the security source of truth.
- Verification is pending; registry remains `in_progress` / unverified.

## 2026-09-30 — prompt-14-materials-v1 closure

- Final implementation/evidence SHA `1f1018b998639b7285e898ae15d456939bcade8a` passed Official CI run `36770674489`: Supply Chain, Quality, Database, Guardrail Simulations, Preview and CI Gate all completed with conclusion `success`.
- Quality passed canonical formatting, lint, typecheck, unit, integration, Harness invariants, security invariants and production build. Materials-specific unit and integration suites each passed 4 tests.
- Database validation applied migrations/seed in clean databases and executed all SQL invariant files, including `supabase/tests/rls_permissions.sql`; existing assertions prove entitlement denial and that authenticated Data API access cannot select `materials.storage_path`.
- Preview Critical E2E passed 3/3, including authorized listing/open through a short private signed URL, direct unauthorized-open denial, deterministic search and favorite → unfavorite → favorite behavior.
- `scripts/assert-canonical-e2e.mjs` printed `Canonical E2E persistence and analytics evidence passed.`; it requires `material_opened` and `material_favorited` and rejects material analytics containing storage paths, signed URLs, service-role material or protected-bucket paths.
- Accessibility passed 6/6 across desktop and mobile projects; product golden regression passed 3/3.
- Preview artifact `11124245839` (digest `sha256:63457b3fdfb841fd4b1a14548c350194c81d43454f93ace84ded03702cde3597`) preserves loaded Materiais screenshots for desktop, tablet and mobile. All three were manually inspected against the approved Materiais reference: hierarchy and responsive recomposition are sound with no overflow.
- Reference-only history sections (`Continue revisando` / `Recentes`) remain intentionally absent because no durable non-analytics material-access history exists. Favoritos uses the existing durable favorite relation.
- No migration/RLS change, admin/CMS, provider, public-material bypass, service-role browser exposure or unrelated future feature was introduced.
- The Official CI distributes the same underlying checks orchestrated by local aggregate aliases such as `verify:agent`, `verify:ui` and `verify:full`; these aggregate wrapper names are not invoked literally by Actions. Exact `verify:security` runs in Quality, while Database/Preview execute the DB/RLS/UI/full-stack constituents.
- Durable closure evidence was persisted under `harness/evidence/prompt-14-materials-v1/`; registry is now `done` and `verified: true`.

## 2026-09-30 — pre-p15-architecture-governance-gate

- Started from `main` at baseline SHA `d57bf780f1b5d5eafd55700c58f4462c29277020`.
- Audited the operational roadmap, Harness registry/plan/progress, Windows tooling evidence, PRE-P13 clean-room evidence, GitHub branch state, repository rulesets, existing CI check name and release environment targets before editing.
- Found exactly one completed-feature dependency contradiction: `pre-p13-environment-gate` was done while `windows-local-tooling` remained `in_progress` in the registry, even though later PRE-P13 evidence had already exercised every missing full-verification prerequisite.
- Normalized `windows-local-tooling` to done/verified and cross-referenced the later clean-room evidence without deleting or rewriting its original failed/prerequisite-missing history.
- Replaced the active roadmap with the requested P00–P26 sequence and moved the old P0–P19 sequence into an explicit superseded legacy section.
- Confirmed P02–P14 remain done/verified; no P15 registry entry or GOAL exists and no P15 product implementation was started.
- GitHub `main` is not effectively protected: branch endpoint reports `protected: false`; ruleset `Yas` id `24223415` is disabled and only contains deletion/non-fast-forward rules. `CI Gate` exists as a successful check but is not required by active protection.
- Classic branch-protection read returns 403 to this integration and no administrative write action exists for branch protection/rulesets/environments. Staging/production workflow targets are observable, but required-reviewer/deployment-branch settings are not administratively readable through the connector.
- Gate is therefore `blocked` pending manual GitHub administration. Green repository/CI checks cannot convert this gate to done until effective `main` protection is independently proven.

## 2026-09-30 — pre-p15 governance CI verification

- First PR CI attempt `36781405404` failed only canonical Prettier formatting in three governance files; those files were formatted without changing semantics.
- Official CI run `36781582010` then passed Supply Chain, Quality, Database, Guardrail Simulations, Preview and CI Gate on head `9de5071fbe06bcfa03a17da7b4339d8771eaa3df`.
- Quality explicitly passed `npm run format:check` and `npm run verify:harness`; the Harness verifier in turn passed Ratchet and Engineering System contracts. Security, build, DB/RLS/full-stack Preview coverage also passed.
- The connected execution runtime could not clone GitHub for separate local aggregate-alias execution; this limitation is recorded in the PRE-P15 evidence rather than treated as a pass.
- CI success does not resolve the governance blocker: `main` protection still requires manual GitHub administration and the PRE-P15 registry entry remains `blocked` / unverified.

## 2026-09-30 — pre-p15 governance protection closure

- Repository operator completed the required GitHub ruleset configuration.
- Re-audit confirmed that main is protected by the active Yas ruleset.
- Pull requests, resolved conversations and the up-to-date CI Gate are required.
- Deletion and force-push style updates are blocked, with no bypass configured.
- PRE-P15 is done and verified. P15 has not started.
- The closure head must pass Official CI before merge.

## 2026-09-30 — prompt-15-practice-engine-v1 reconciliation

- Revalidated the stale P15 Harness state before P16.
- PR #19 is merged into `main` at `1dfe816ee1df811c313c27710c2fed24d3ddfbf1`.
- Official CI run `36796533133` / run number 223 for implementation head `f10fdfd33ba8d31679b511a81a51cee3b1e1b086` completed successfully.
- Inspected jobs: Supply Chain, Quality, Database, Guardrail Simulations, Preview and CI Gate all concluded `success`; Preview includes Critical E2E, persistence/analytics, accessibility and visual gates.
- Added durable P15 reconciliation evidence without claiming any unobserved local command, then moved P15 to `done / verified:true`.

## 2026-09-30 — prompt-16-agenda-v1

- Started from current `main` merge commit `1dfe816ee1df811c313c27710c2fed24d3ddfbf1` on branch `feat/agenda-v1`.
- Read Product, Live, Billing, data, architecture, auth/RLS, security, UI, Design System, accessibility, analytics, observability, testing, Definition of Done, open questions and Agenda reference contracts.
- Inspected the approved Agenda screenshot directly and preserved behavior/security precedence over its broader calendar/event affordances.
- Confirmed existing source-of-truth contracts: `live_sessions.capacity`, `session_bookings` uniqueness, `private.entitlement_limit`, `private.current_user_has_entitlement`, `private.validate_booking()` row lock/capacity/entitlement guard, booking audit trigger and owner-only booking RLS.
- Confirmed `authenticated` still has no direct INSERT on `session_bookings`; students may read scheduled/completed session metadata and only their own booking rows.
- Scope decision: add only a safe aggregate read model and authenticated booking RPC that derives `auth.uid()`; do not implement cancellation, credit-window consumption, meeting provider or Teacher/Admin portals.
- Registered the P16 goal, plan and registry entry before runtime implementation.

## 2026-09-30 — prompt-16-agenda-v1 closure

- Implemented the Agenda V1 Student vertical slice on top of the existing Live domain: aggregate availability projection, upcoming own bookings, authenticated booking RPC, schedule domain/application/server adapter, responsive `/agenda` UI and Student navigation.
- Booking accepts only `live_session_id`; PostgreSQL derives ownership from `auth.uid()` and requires the durable Student role. The pre-existing service-role helper now delegates to this single boundary.
- Existing `private.validate_booking()` remains the authoritative SCHEDULED/entitlement/capacity trigger. Direct authenticated INSERT into `session_bookings` remains denied.
- Agenda SQL evidence proves entitlement denial, non-scheduled denial, capacity rejection, retry-safe duplicate booking, no cross-user booking-id leakage and owner derivation from auth context.
- Official Preview executed real two-connection PostgreSQL concurrency at capacity=1 and logged: `Agenda real concurrency passed: two concurrent users, exactly one BOOKED.`
- Critical E2E passed 3/3 and proved persisted booking → BOOKED → refresh remains BOOKED. The post-E2E assertion passed and requires exactly one `live_session_booked:<booking_id>` analytics record for the canonical booking.
- Accessibility passed 10/10 after correcting the mobile horizontal date strip so the actual scroll container is keyboard-focusable and uses the existing Design System focus token.
- Product golden regression passed 3/3; Storybook/design-system visuals also passed.
- Preview artifact `11136452829` with digest `sha256:004fa095fb733331982783076932f2b5f3042bba4df3b8432343d2a2642fde4d` was downloaded. `agenda-desktop.png`, `agenda-tablet.png` and `agenda-mobile.png` were opened and inspected against the approved Agenda reference.
- The visual implementation preserves the approved hierarchy and palette while intentionally omitting unsupported reference-only behavior such as full calendar scheduling, practice/event creation and meeting-provider actions.
- Verification history remains visible: CI #225 caught canonical formatting; #243 caught the stale booking security invariant; #245 caught shared commercial-fixture regression; #251 caught the mobile scrollable-region a11y issue. Each root cause was corrected without weakening a gate.
- Final implementation head `14b577729aeafcd7986d7da35903499e4ebb5adc` passed Official CI #253 / run `36802148610`: Supply Chain, Quality, Database, Guardrail Simulations, Preview and CI Gate all concluded `success`.
- Final `main...feat/agenda-v1` scope audit found no Teacher/Admin portal, cancellation/rescheduling/no-show/attendance mutation, credit-window policy, meeting provider, CEFR logic or curricular-progress behavior.
- Durable evidence is stored under `harness/evidence/prompt-16-agenda-v1/`; registry is `done / verified:true`. PR #20 remains open and unmerged.

## 2026-09-30 — prompt-17-teacher-operations-v1

- Baseline confirmed at `main@a77386df147805f8ecd236f63657c90d251b3c63`; Agenda PR #20 is incorporated and P15/P16 are done/verified.
- Created `feat/teacher-operations-v1` without writing to main.
- Added Teacher-only + AAL2 read models for own sessions and own-session roster.
- Added atomic attendance upsert + attendance audit trigger; no direct authenticated attendance DML was granted.
- Added dedicated Teacher shell/routes, unit/application/real-PostgreSQL/E2E/a11y coverage and responsive screenshot capture.
- Added canonical Teacher A/Teacher B fixtures and real MFA TOTP test helper with the secret stored only in the OS temporary directory.
- Synchronized Live/Auth/Audit/Data Model/Open Questions contracts.
- Current state: implementation complete enough for Official CI; feature remains `in_progress` / `verified: false` until all mandatory gates are inspected green.

## 2026-10-01 — prompt-17 Teacher MFA verification correction

- Official CI #282 / run `36810184169` passed Supply Chain, Quality, Database and Guardrail Simulations. Preview also passed the real database integration and RLS steps, proving the prior Teacher audit/DB assertion failure was corrected.
- Critical E2E then failed only in the real Teacher MFA path: the MFA page rendered, but Supabase returned `mfa_totp_enroll_not_enabled`, so the authenticator-code field never became available.
- Preview artifact `11139423780` and its Playwright trace confirmed the exact Auth response. The checked-in local Supabase config had both TOTP enrollment and verification disabled.
- Corrective action is intentionally environment-scoped: enable TOTP enrollment/verification in `supabase/config.toml` for local/Preview verification. No production migration, RLS policy, role rule, attendance boundary or MFA assertion is weakened.
- P17 remains `in_progress` / `verified: false` until a fresh full Official CI reaches persistence, a11y, visual evidence, artifact upload and CI Gate successfully.

## 2026-10-01 — prompt-17 Teacher Operations V1 closure

- Final implementation head `30bd79874cf7a05218f5ce1f2fa5f67c88f22b6b` passed Official CI #300 / run `36816618361`.
- Supply Chain, Quality, Database, Guardrail Simulations, Preview and CI Gate all concluded `success`.
- Preview re-proved clean DB integration, RLS, observability, real Teacher MFA, 5/5 Critical E2E, post-E2E persistence/analytics, 12/12 accessibility, Storybook, 6/6 design-system visuals and 3/3 product golden visuals.
- Post-E2E Teacher attendance and audit evidence is verified directly against PostgreSQL: attendance persisted as ATTENDED, `marked_by_user_id` matched the authenticated Teacher, and the audit fact retained actor/session/booking/attendance/final-state evidence without forbidden privacy categories.
- Preview artifact `11142120950` with digest `sha256:3edba2c1deaca02790e34f567950e88456d037346e47ebde6b60474c3a53c865` was downloaded. Teacher desktop/tablet/mobile screenshots were manually inspected with no visible clipping/overflow; persisted attendance and action controls are visible on tablet/mobile.
- Failure history remains preserved: semantic audit ordering, local TOTP enablement, stale MFA factor recovery, attendance locator specificity and privileged post-E2E persistence inspection were each corrected at the first real failing gate without weakening authorization or assertions.
- Final scope audit found no billing editor, Practice/CEFR feature, cancellation/rescheduling, meeting provider, Admin CMS, availability CRUD, historical migration edit or global authorization widening.
- Durable closure evidence is stored under `harness/evidence/prompt-17-teacher-operations-v1/`; registry is now `done / verified:true`.
- PR #21 remains open and unmerged. No merge to `main` was performed.

## 2026-10-01 — prompt-18 Admin Content V1 implementation

- Product-owner decision recorded in ADR 0006: ADMIN+AAL2 can publish/unpublish directly in V1; no review workflow is inferred.
- Added a separate DRAFT/PUBLISHED contract to the existing content entities, effective-publication RLS, narrow audited Admin RPCs, Student publication filters, server-side Admin Content routes and reusable UI forms. No parallel CMS table, service-role client use, binary upload service, assessment authoring, billing, role editor or analytics dashboard was added.
- A clean local Supabase reset replayed nine migrations and canonical seed successfully. Focused real DB integration passed six SQL files plus the Agenda concurrency proof; focused RLS passed three SQL files. The new Admin SQL proof covers role/AAL2 denial, draft/direct-ID isolation, publication validation, parent visibility, atomic reorder, authenticated audit attribution/correlation and rollback on audit failure.
- Admin Content E2E passed 1/1: real Admin MFA, draft creation/preview, Student draft invisibility, publication visibility, reorder, unpublish and persisted reload behavior. Focused a11y passed 2/2 at desktop and mobile with keyboard focus and WCAG A/AA checks. Desktop evidence was inspected under `artifacts/prompt-18-admin-content/`.
- Operator requested that broad gates be listed rather than executed. P18 remains `in_progress` / unverified until those commands are run and their evidence is inspected.

## 2026-10-01 — prompt-19 Assessment Engine V1 discovery

- Started from `main@af0857d79345db9ed02f8624868c6b061cc71d0f` on `feat/p19-assessment-engine-v1`; main was not modified.
- Read the required CEFR Assessment, data, product, architecture, auth/RLS, security, analytics, testing, Definition of Done, open-question and Harness contracts plus the Practice V1 canonical implementation.
- Confirmed the existing Assessment tables and database guards for published-version attempts, published/used version/item immutability and response/version consistency.
- Found a concrete security gap: historical grants expose complete `assessment_versions` and `assessment_items` rows to authenticated users, including `scoring_config` and `answer_key` when RLS permits the row.
- Confirmed no Assessment user-facing route/UX is contracted in the current repository, so P19 will not invent Progress/Assessment UI.
- Standard setting/cut scores, retake policy, Speaking/Pronunciation evaluation and Assessment Authoring remain explicitly open. Registry is `in_progress / verified:false`; no verification PASS has been claimed.

## 2026-10-01 — prompt-19 Assessment Engine V1 closure

- Implemented the Assessment lifecycle on `feat/p19-assessment-engine-v1` without adding a user-facing Assessment/Progress UI or inventing unresolved pedagogical policy.
- Added retry-safe published-version start, frozen attempt version, server-validated responses, idempotent completion, deterministic objective SkillScores, manual-pending behavior and stable analytics keys.
- Closed the discovered authenticated Data API exposure by replacing broad Assessment version/item SELECT with safe column-level reads; answer keys, rubrics and scoring configuration remain server-side.
- Real PostgreSQL proof covers start/completion idempotency, version/item immutability, cross-version rejection, cross-Student isolation, direct-DML denial, secret-column denial, pending Speaking, objective scoring and CEFR-null invariants.
- Formatting failures were diagnosed with the repository-pinned Prettier output rather than bypassed; the official workflow was restored before final verification.
- Official CI #319 / run `36926422998` on head `31e49149fe6f2fb73f307d2fedc70db21608f5bd` passed Supply Chain, Quality, Database, Guardrail Simulations, Preview and CI Gate.
- Quality passed format, lint, typecheck, 47/47 unit tests, 32 application integration tests with one intentional live-test skip, harness/security invariants and production build.
- Preview passed 7-file DB integration, 4-file RLS, 6/6 Critical E2E, persistence/analytics, 14/14 accessibility, Storybook, 6/6 design-system visuals and 3/3 product golden visuals.
- Standard setting/cut scores, retake policy, Assessment Authoring and automatic Speaking/Pronunciation evaluation remain unresolved by design.
- Durable evidence is stored under `harness/evidence/prompt-19-assessment-engine-v1/`; registry is now `done / verified:true`.
- PR #23 remains open and unmerged. P18 remains independently `in_progress / verified:false`.

## 2026-10-01 — prompt-20 Progresso V1 discovery

- Started from `main@93666bf0478b9dabdc35c89dab72596026d7da9e` on `feat/p20-progress-v1`; main was not modified.
- Confirmed P19 Assessment Engine V1 is incorporated in main and CEFR standard setting/cut scores remain explicitly open.
- Read the Progress/product/data/architecture/Practice/Live/UI/accessibility/security/testing/performance/open-question/Harness contracts and inspected the canonical Learning, Practice, Schedule/Attendance, Teacher Operations and Assessment implementations.
- Chosen architecture is a read-only Progress projection: server-authenticated Student identity, four independent domain reads, bounded bulk queries, `Promise.allSettled` partial-failure semantics, and no new source of truth.
- Learning completion will reuse existing progress functions; Practice, Attendance and SkillScores remain semantically separate; CEFR will render unavailable rather than inferred.
- No database migration is currently justified. Registry is `in_progress / verified:false`; all verification remains pending.

## 2026-10-01 — prompt-20 verification hardening

- Official CI exposed and preserved three concrete fixture/evidence failures without weakening runtime contracts: a booking created after session completion, an Assessment item inserted after version publication, and visual captures taken while the Progress loading state was still visible.
- The fixture now follows the existing Live lifecycle (SCHEDULED → booking/attendance → COMPLETED) and Assessment immutability lifecycle (DRAFT → item → PUBLISHED), while remaining re-runnable for E2E, accessibility and golden resets.
- Stable Progress desktop/tablet/mobile captures from Official CI were inspected before promotion to golden baselines; the golden tolerance was not changed.
- Progress browser-boundary E2E now inspects browser-visible `/progresso` payloads for forbidden Assessment/service-role fields in addition to the existing Student isolation and RLS evidence.
- P20 remains `in_progress / verified:false` until the clean-head Official CI, including golden visual checks and CI Gate, completes successfully.

## 2026-10-01 — prompt-20 Progresso V1 closure

- P20 is complete as a read-only Student Progress projection over Learning, Practice, Attendance and Assessment.
- No new Progress source of truth, migration, runtime service-role path, persisted streak/goal or write command was introduced.
- Course completion reuses canonical Learning semantics; Practice, Attendance and Assessment facts remain separate; missing/pending values are not converted to zero.
- CEFR remains unavailable while standard setting/cut scores are unresolved.
- Browser-boundary E2E rejects Assessment answer keys, rubrics, scoring configuration and service-role material.
- Unit/application coverage proves unauthorized, empty, success, partial/error, concurrent reads and bounded repository calls.
- Desktop/tablet/mobile Progress screenshots were inspected before promotion to golden baselines; no tolerance, skip or retry was weakened.
- `verify:agent`, `verify:security`, `verify:ui` and isolated `verify:full` passed.
- Official CI #359 / run `36941525748` passed all mandatory jobs, including Preview and CI Gate.
- Durable evidence is stored under `harness/evidence/prompt-20-progress-v1/`.
- Registry is `done / verified:true`. PR #24 remains open and unmerged.

## 2026-10-01 — prompt-21 Home Projection V1 closure

- Replaced the former Learning-only Home with a read-only transversal Student projection over Learning, Practice and Schedule; curricular Progress is derived from the same Learning facts through the existing P20 curriculum projection.
- Added one request-scoped authenticated server context shared by Student layout and Home, eliminating duplicate auth/client creation within the Home request path.
- Primary-action policy is deterministic and singular: own BOOKED session happening now → most recently accessed incomplete lesson → canonical first incomplete lesson → existing Practice recommendation → future own booking.
- Practice recommendation remains owned by `recommendPractice`; Home consumes a narrow candidate projection that excludes full activity content and answer payloads.
- Schedule owns the Home booking read boundary and scopes it to the authenticated Student; Home does not reproduce capacity, entitlement, cancellation or booking mutation policy.
- Multiple courses remain separate and never become a global completion average.
- Empty, partial, error and unauthorized states are distinct; failures are not silently converted to empty data.
- Dedicated Home loading/error states and responsive desktop/tablet/mobile composition were added without converting the page to a Client Component.
- Verification history remains preserved: initial formatting failure, architecture corrections for auth/Schedule/Practice/Progress ownership, stateful E2E retry contamination and expected golden mismatch were fixed at their root causes without weakening assertions, timeouts, RLS or visual tolerance.
- Actual Home desktop/tablet/mobile screenshots were inspected before promotion of only the three Home Linux golden baselines.
- Verified implementation head `a4def7c55943961face164cf411247f11f4dca1a` passed Official CI #394 / run `36952067156`: Supply Chain, Quality, Database, Guardrail Simulations, Preview and CI Gate all concluded `success`.
- Preview passed real DB integration/concurrency, RLS, observability, Critical E2E, persistence/analytics, accessibility, Storybook/design-system visuals and product golden visuals.
- Preview artifact `11204268174` has digest `sha256:8f39c44f6ad471cbab4a3300cf073532254188001d5725d9963d64a0f9839b59`.
- Final scope audit found no P21 migration, Home write path, runtime service-role path, CEFR/streak/goal/commercial policy, Assessment/Teacher/Admin expansion or parallel recommendation engine.
- Durable evidence is stored under `harness/evidence/prompt-21-home-projection-v1/`; registry is `done / verified:true`.
- PR #25 remains open against `main` and intentionally unmerged.

## 2026-10-01 — P21 recovery reopened

- P21 was reopened after an integrity audit found that the previous closure
  referenced an older implementation SHA while the branch had moved and carried
  temporary Official CI workflow edits.
- `.github/workflows/foundation-verify.yml` was restored exactly to `main`;
  the current `main...branch` diff contains no workflow or migration changes.
- Harness was returned to `in_progress / verified:false`; historical green
  runs remain evidence only for the exact SHAs they tested.
- Schedule Home reads now receive the same explicit `now` used by Home,
  require own BOOKED booking + SCHEDULED live session + `ends_at > now`,
  order by referenced `starts_at`, and limit the database result to one.
- Canonical E2E fixture now includes BOOKED rows linked to CANCELLED and
  COMPLETED sessions for the Home-now Student. The Home flow must prove those
  readable-but-invalid sessions never surface while the valid SCHEDULED current
  session remains the primary action.
- Final verification is still pending. No success claim is valid until a clean
  implementation head passes the unmodified Official CI.

## 2026-10-01 — P21 recovery verified closure

- Recovery implementation head `0b80af3945c21ebcbc6f208c6625fae97e3df9ff` passed the unmodified
  Official CI #422 / run `36956118087`: Supply Chain, Quality, Database,
  Guardrail Simulations, Preview and CI Gate all succeeded.
- Quality proved canonical format, lint, typecheck, unit, integration, Harness,
  security and production build.
- Preview proved real DB integration/concurrency, RLS, observability, the
  canonical E2E regression, persistence/analytics, accessibility, Storybook,
  design-system visuals and product goldens.
- The regression fixture contains own BOOKED rows linked to CANCELLED and
  COMPLETED sessions; neither surfaced in Home, while the valid SCHEDULED
  current session remained the primary action.
- Literal `verify:agent`, `verify:security`, `verify:ui` and
  `verify:full` all passed in isolated jobs that checked out the same
  implementation SHA (run `36956848003`).
- Preview artifact `11206068526` was downloaded and Home desktop/tablet/mobile
  were manually inspected with no visible clipping or overflow.
- Artifact digest: `sha256:097dd0ba65389ddb757c76acec318985e529b2d0ddf51b8ee42cf8208fd2ac81`.
- Final implementation scope contains no workflow or migration diff, no Home
  write path, no runtime service-role access and no new CEFR/streak/goal or
  commercial policy.
- Registry/evidence now move to `done / verified:true`. PR #25 remains open
  against `main` and no merge was performed.

## P21.1–P21.3 implementation checkpoint — 2026-10-02

Branch feat/p21-p0-foundation-closure; base main 94b574b40b8b05ed798f996294d2297ba92b5e31. Role-aware routing, STUDENT guard, transactional quota/cancel/rebook, immutable snapshot, cohort administration/RLS and additive Teacher scope implemented. Four focused browser scenarios passed with real MFA and axe. Full SQL integration/RLS passed before the final lifecycle/race additions; final rerun in progress. Main-to-feature legacy upgrade passed including ambiguity blocker and original UUID compatibility. Final aliases and Official CI remain pending; verified:false.

## P21.1–P21.3 final closure — 2026-10-02

All five literal local aliases passed. Final full: 86 unit, 54 integration (one pre-existing conditional live-observability skip), 9 integration SQL + 5 RLS SQL, synchronized capacity/quota/retry/cancel/Teacher races, 14 E2E, 16 a11y, 6 design-system and 3 strict golden projects, production build and behavioral eval. Main upgrade and multiple clean replays are recorded. Windows Home references were stale; Progress Windows references were absent in main. Corrected against unchanged main UI with evidence, preserved thresholds, and strengthened the platform matrix to 24. Cold navigation tests now await real login POST and authenticated preview HTTP 200; URL timeouts unchanged. Harness done/verified:true. PR #30; CI on 775845a passed. User explicitly waived awaiting final CI. No merge or remote migration.

## 2026-10-02 — P21 P1 implementation stopped at user request

Base 78c4c689b6fbabde56083b417e7bbbfc9e302ccb and branch feat/p21-p1-core-experience verified. Additive operations/pedagogy/video implementation and SQL/concurrency evidence produced. Final lint/typecheck, structural harness/security/DB passed. Two clean local replays and SQL/RLS passed before the final audio metadata hardening. Full agent gate failed a GOAL documentation declaration (corrected, not fully rerun). E2E loops, legacy upgrade, visual review, full/UI gates and Official CI remain pending. User asked to stop because credits were running out; no completion claim. See harness/evidence/p21-p1-core-experience/REPORT.md. Registry remains in_progress and verified:false.

## 2026-10-03 ? P21 reconciliation / Stage 01 start

Fetched main matches requested SHA 22b0562eaf308fabd363107feeecb639a126484e. PR #31 merged; Official CI 37080829934 inspected green across all jobs. Historical interruption report retained. Real Mux smoke unverified: combined P21 remains in_progress/verified:false. Stage 01 branch/GOAL created; no prior Placement domain found. Untracked Laya scripts preserved.

## A11y five failures � 2026-10-03

One joint Laya call; rejected inaccurate environment hypotheses after browser proof. TeacherLoading generic-div name fixed with role=status. Four Placement focus failures arise from hidden streamed S:0 content, not remount/disabled/inert/redirect; three visibility assertions gate initial focus without changing focus assertions/timeouts. Single npm run test:a11y: exit 0, 28 passed, 0 skipped (4.0m). Evidence: harness/evidence/a11y-five-failures; ratchet: harness/failure-log/2026-10-03-a11y-streamed-focus.md. Existing artifacts and SQL diff preserved; verified flags untouched. verify:full deferred; no commit/push.

## GitHub publishing � 2026-10-03

User explicitly requested GitHub push, superseding the prior no-commit/push restriction. Existing a11y suite reports 28 passed. Full verification remains pending; publishing does not declare Stage 01 verified. Remote branch confirmed at f82528ff4a6a4aed510515d5ede2ccfbfdbb1c10 before commit.

# 2026-10-03 — Stage 02 Operations started

- Yas Laya status returned `LAYA_READY`; `execution_authority=false`.
- `main` and freshly fetched `origin/main` are `34f5e32f313fe16b8c09bcf13b64b4a7d11b9236`; Stage 01 is present as done/verified in registry and evidence.
- Created `feat/stage-02-operations`; worktree was clean before Harness setup.
- Existing `p21-p1-core-experience` and `prompt-18-admin-content-v1` remain in progress and are explicit preservation constraints.
- Open questions about billing/meeting providers, exception policies, and future Teacher portal scope remain unresolved and outside the Stage 02 implementation assumptions.
- Runtime: Admin Overview reads bounded Placement review/decision queues and the shell opens on the operational entry while preserving existing navigation.
- Focused validation: TypeScript, ESLint, Prettier, `git diff --check`, and Admin Overview/Cohorts E2E pass. The E2E exercised axe at desktop/tablet/mobile and produced screenshots that were inspected and stored under `harness/evidence/stage-02-operations/`.
- The initial E2E run timed out after mobile screenshots because the test then searched for a desktop-only sidebar link. The test now restores desktop viewport before continuing; rerun passed. Visual review also removed a nested empty-state frame, and the refreshed E2E passed.
- The global npm shim points to a missing npm-cli.js; project-local `node_modules/.bin` executables were used for available checks. Docker access required elevation; the existing local Supabase database was retained and canonical fixtures were prepared without a database reset.
- Stage 02 remains `in_progress / verified:false`. Other domains and all full gates remain unimplemented/unexecuted.

# 2026-10-04 — Stage 02 Admin Students directory

- Continued after scoped cleanup: removed only `artifacts/stage-02-operations/admin-overview-{desktop,mobile,tablet}.png`, all generated by this execution. Preserved `artifacts/p21-foundation/cohort-admin-desktop.png` (hash confirmed unchanged); current status showed no unrelated removals.
- Added `public.admin_student_directory`: Admin+AAL2 enforced in the database, Student-role-only rows, name substring search with escaped LIKE metacharacters, stable ordering, max 50 rows, and offset paging. No email or service-role access.
- Added `/admin/students`, Admin navigation entry, and a 25-row paginated directory. Student 360 and focused DB/RLS/UI tests remain pending; feature stays `in_progress / verified:false`.
- Focused local checks: TypeScript, ESLint, Prettier on TypeScript files, and `git diff --check` passed. Supabase CLI migration inspection was blocked because telemetry attempted a write to `%USERPROFILE%\.supabase`, outside writable roots; migration has not been applied or DB-tested. Do not treat this block as verified.

# 2026-10-04 — Admin Students directory stable; Student 360 started

- Resolved the CLI write failure with the documented `SUPABASE_TELEMETRY_DISABLED=1` (also `DO_NOT_TRACK=1`) and a temporary writable `SUPABASE_HOME`; no product code was changed for the environment issue.
- Applied migration `20261004090000_stage_02_admin_student_directory.sql` to the local Supabase database; `supabase migration list --local` confirms local and remote migration ledgers match for this migration.
- Added isolated `students-directory` SQL test target. Passed Admin+AAL2 access, Admin+AAL1 denial, Teacher and Student denials, Student-only listing, stable bounded/offset paging, literal wildcard search, invalid input rejection, RLS on base tables, no authenticated write grants, and authenticated-only RPC execute grant.
- Directory block is stable. Student 360 is the next in-progress sub-block; Stage 02 remains `in_progress / verified:false`; final gates are not run.
- Implemented Student 360 at `/admin/students/[id]` using existing profile, enrollment, cohort membership, placement, and lesson-progress records only. All row queries are bounded (20/20/1/10); lesson completion is an aggregate; no CEFR inference or email exposure.
- Student 360 TypeScript/ESLint passed. Focused Chromium E2E assertions passed through canonical Admin MFA and Axe. Playwright's test assertions reported success, but its webServer teardown hung; I interrupted that process (command exit 1), so record the spec pass with a teardown caveat and retain `verified:false`.
- Completeness delta: added bounded existing-source projections for active cohort/course and primary cohort teacher, next booked scheduled session, curricular completion (canonical completion_percent semantics), recent Practice, Attendance, valid SCORED Assessment only, Placement review/decision/transfers, and local subscription status/period only. Account active/suspended state is not modeled, so none is fabricated. Fixed query count; no `student_360` table, provider/financial fields, Teacher route reuse, or N+1 loops.
- Added migration `20261004120000_stage_02_student_curriculum_summary.sql` and extended the isolated SQL/RLS test. Local migration applied; summary RPC passed Admin+AAL2, AAL1/Teacher/Student deny and published-curriculum assertions. Expanded Student 360 Chromium E2E reported one pass with all section assertions and Axe.
- Student 360 completeness review closed; next Stage 02 block is Admin Teachers. Stage remains `in_progress / verified:false`; final gates not run.
- Student 360 follow-up: deep links now verify the target still has the `STUDENT` role before loading detailed records. Existing `user_roles` RLS already restricts this lookup to Admin+AAL2. Re-ran TypeScript, focused ESLint, diff-check, and `students-directory` SQL/RLS successfully using local DB port 55322. Admin+AAL2 allow, Admin+AAL1/Teacher/Student deny, bounded pages, and no global authenticated writes remain covered.
- Admin Teachers is now the active Stage 02 block. Discovery confirms use existing `teachers`, `teacher_availability`, `cohort_teachers`, sessions, Placement/manual reviews, and audit records; capability tracks should reference existing Courses. Provisioning must reconcile retries across Auth/Postgres; deactivation must block on unresolved future sessions, primary cohorts, or reviews rather than silently reassign. No Admin Teachers implementation is claimed yet.
- Admin Teachers Laya routing: `workstream=security`; `next_action=inspect_code`; `scope_width=focused`; `risk=medium`; `answer_confidence={workstream:0.9941,risk:0.7143,next_action:0.6311,needs_external_docs:0.9433,scope_width:0.5468}`.

# 2026-10-04 — Admin Teachers focused block close

- Implemented `/admin/teachers` as a bounded Admin+AAL2 operational directory using existing Teacher, availability, cohort, session, review, and Course records; workload and alerts are derived from those records.
- Added an explicit Teacher-Course capability relation, server-only Auth invitation and idempotent Auth/Postgres reconciliation. The browser cannot choose role/teacher identity; no temporary password or email-delivery claim is stored or displayed.
- Added guarded activation/deactivation, cohort assignment through existing `manage_cohort()` semantics (preserving temporal `is_primary` history), critical audit events, and deactivation blockers for future sessions, primary cohorts, and pending reviews. Nothing is silently reassigned.
- Local migration `20261004130000_stage_02_admin_teachers.sql` applied. Focused SQL/RLS suite passed Admin+AAL2 authorization, AAL1 and non-admin role denials, service-only reconciliation, retry idempotency, bounded/search projections, capability and cohort history, dependency blocks, audit, and no global authenticated table access/direct role mutation.
- Application tests passed 5/5; TypeScript, focused ESLint, Prettier and `git diff --check` passed. Admin Teachers Playwright/Axe spec is implemented but could not start because local canonical E2E credentials are absent; no credential reset or auth fixture mutation was attempted.
- Close at the Admin Teachers block. The earlier Student 360 Playwright teardown caveat remains recorded. Do not start Cohorts V2 or run any final verification gate; `stage-02-operations` remains `in_progress / verified:false`.

# 2026-10-04 — Stage 02 Cohorts, Teacher surfaces, and CRM continuation

- Confirmed the active branch remains `feat/stage-02-operations` at base SHA `34f5e32f313fe16b8c09bcf13b64b4a7d11b9236`; preserved all existing P21/Stage01 evidence and worktree changes.
- Laya `multilingual` route for Admin Cohorts: workstream `application/read_docs`, medium risk, focused scope; treated only as initial navigation. Cohorts V2 implementation and the focused DB/RLS/E2E evidence are recorded in the Stage 02 evidence report.
- Re-routed Teacher surfaces at block start. Laya suggested security-first investigation with medium risk/focused scope but low action confidence. Read only the Teacher operations, pedagogy, auth/RLS, and existing projection sources before editing.
- Added local migration `20261004150000_stage_02_teacher_surface_projection.sql`: teacher-authorized cohort/roster/schedule/occupancy/next-session read model, bounded operational arrays, and capped default Practice review queue. Applied locally with telemetry writes redirected to a temporary writable Supabase home; no product/security bypass was used.
- Teacher detail now composes RLS-scoped enrollments/Courses, recent curriculum progress (explicitly not CEFR proficiency), Practice state, scored Assessments only, Attendance, authorized Placement review/choice, teacher notes, booked own-session homework, and related sessions. Query counts are fixed and result sets bounded; homework is intersected with the target Student's own BOOKED sessions. No billing, CRM, private Admin notes, arbitrary Student access, or N+1 loop was added.
- Focused `p21_core_experience.sql`, `teacher_operations.sql`, `cohorts.sql`, and `placement.sql` passed with the new teacher projection migration applied. TypeScript and focused ESLint passed. Canonical Teacher E2E/Axe passed on `/teacher`, `/teacher/turmas`, `/teacher/alunos`, and Student detail, including mobile overflow check and screenshot inspection.
- Laya `multilingual` route for CRM: application, medium risk, focused scope; external-doc suggestion was low-confidence/ambiguous, so local contracts were authoritative.
- Added local migration `20261004160000_stage_02_crm_leads_v1.sql`, Admin+AAL2 bounded list and guarded mutation RPCs, RLS with no direct anon/authenticated table grants, domain state-transition validation, server-only application entry points, and accessible `/admin/leads` list/detail workflow. Lead creation does not create an Auth/profile/role/enrollment/Placement identity; linking accepts only an existing Student. Owners are validated Admin/Support identities. Consent remains unmodeled, with no inferred status or delivery claim.
- Focused `admin-crm` SQL/RLS suite passes Admin+AAL2 allow and AAL1/Teacher/Student/Support/anonymous denies; bounded/literal search; direct table denial; valid/invalid stage transitions; owner checks; task create/complete; interaction/audit; existing Student link; and no role creation/mutation. CRM domain unit tests pass 2/2.
- Canonical local E2E fixture ran through the repository's existing helper with an ephemeral process-only password. Admin Teachers E2E/Axe, Admin Students, Admin Cohorts and Admin Leads all passed in the combined run; focused Teacher surfaces and Admin Leads E2E/Axe passed on subsequent final runs. The Lead mobile screenshot and Teacher Student detail screenshot were visually inspected. Selector-only test failures were corrected without product security changes.
- Updated CRM, Auth/RLS, audit and documentation map contracts. The prior Student 360 auxiliary Playwright teardown caveat remains historical evidence as requested; current combined Admin Students E2E completed normally. Stage 02 remains `in_progress / verified:false`. Final gates, full SQL/RLS suites, clean replay, build/regression audit, commit/push/PR/Official CI remain pending.

# 2026-10-04 — Full-gate audit in progress

- `verify:agent`, `verify:security`, and `verify:db` completed successfully in this execution. `verify:ui` ran in isolated Next output/port with a process-only canonical password: Storybook build passed and Playwright reported 27 passed / 1 failed.
- Initial full UI run: 27 passed / 1 failed. Placement had not been reproducible while Docker was stopped (`OpenService` access denied). The user started Docker Desktop; local Supabase is now accessible.
- Focused Placement reproduction initially exceeded the default 5-second autosave assertion. Increased only save-status waits to 15 seconds and asserted redirect to `/onboarding/placement`; canonical-fixture focused rerun passed end-to-end (1/1; 1.3m test, 1.8m runner). This result does not replace the initial full UI run until the suite is rerun.
- The full run had overwritten 28 tracked PNGs in Canonical Slice, Prompt 18 Admin Content and Stage 01. Restored only those paths from the existing index; status now shows no modifications in those directories. E2E screenshot destinations now use per-test Playwright output and attachments to protect retained Stage 01/P21/Stage 02 evidence. Newly generated untracked screenshots remain preserved; no P21 artifact was removed.
- Stage 02 remains `in_progress / verified:false`. `verify:full`, PR/Official CI and final evidence reconciliation remain pending. Historical helper teardown caveat remains recorded; it was not refactored.

# 2026-10-04 — Full local verification passed

- Fixed the repeatable TOTP replay in serial E2E by ensuring the canonical Admin fixture uses a distinct 30-second TOTP step for each login. Admin Cohorts and Admin Teachers tests also receive a 60-second per-test limit for their heavier Axe checks; multi-role auth navigation has a scoped longer wait. No product authentication behavior was changed.
- Full `verify:ui` passed: Storybook build; E2E 28/28; accessibility 28/28; Storybook visual 6/6; golden desktop/tablet/mobile 3/3.
- `npm run verify:full` passed after a clean local Supabase reset and migration replay. Core formatting/lint/typecheck/build, unit 96/96, integration 68 passed/1 skipped, DB integration (11 SQL files), RLS (7 SQL files), Harness, security, agent eval, E2E 28/28, canonical persistence/analytics assertion, a11y 28/28, Storybook visual 6/6 and golden 3/3 all completed.
- The known Student 360 auxiliary Playwright teardown note remains historical; the combined E2E exited successfully and the caveat was not refactored.
- No retained P21/Stage01 evidence was removed. `artifacts/p21-foundation/*` remains untouched; only screenshots from the explicitly authorized Stage 02 temporary-output cleanup were removed earlier. Current E2E captures use Playwright per-test output paths.
- Stage 02 remains `in_progress / verified:false`. Commit/push, PR creation, actual Official CI and final-state CI remain pending; do not merge.

# 2026-10-04 — Stage 02 publication audit

- Reconciled current local state: branch `feat/stage-02-operations` is at `7c157c90bd82698d4b9a17a0954c9078056409f2` and local Git reports it aligned with `origin/feat/stage-02-operations`. The commit contains the Stage 02 implementation and full local verification evidence.
- Inspected the public GitHub pull-request list and branch comparison. The feature branch appears with one commit/76 changed files, but no Stage 02 PR exists. GitHub shows Sign in and the PR creation flow is unavailable without an authenticated session; no PR was created and no merge was attempted.
- Corrected the Stage 02 evidence README to record the pushed head and accurately leave PR/Official CI pending. The verification manifest already records `pull_request: null`, `not_run: ["Official CI"]`, and `verified: false`.
- `npm run verify:agent` passed after the evaluator correction. A final `npm run verify:full` rerun is required before recording current-state evidence; actual Official CI and final-state CI still require a PR.
- Preserved untracked `artifacts/canonical-slice/*` and `artifacts/p21-foundation/*`; they remain outside the commit and untouched. Stage 02 stays `in_progress / verified:false`.
- Follow-up `verify:agent` initially reproduced two evaluator defects: prose-only GOAL scope was not parsed, and the RLS proxy accepted only the central permissions test despite changed, registered per-domain authorization SQL. Updated concrete GOAL globs and the evaluator; `verify:agent` then passed all 10 rules. Durable red/green record: `harness/failure-log/2026-10-04-stage-02-agent-eval-scope-and-rls.md`.
- Final `verify:full` passed after clean local Supabase reset/replay on `3c6db60`: 96 unit tests, 68 integration passed/1 skipped, 11 SQL integration files, 7 RLS files, Harness/security/eval, E2E 28/28, canonical persistence/analytics, a11y 28/28, Storybook 6/6 and golden 3/3. Used temporary workspace `SUPABASE_HOME`, official CLI telemetry opt-out variables, and isolated Playwright port 4001; no product security settings changed.
- Stage 02 remains `in_progress / verified:false`. The first implementation commit is pushed, but `3c6db60` remains ahead of origin. The GitHub public compare/pull page shows no Stage 02 PR and requires sign-in; Official CI and final-state CI therefore remain pending. No merge attempted.

# 2026-10-04 — Stage 02 final verification and publication

- Fixed the Official CI-discovered `service_role` permission error in `supabase/tests/admin_teachers.sql` without changing product grants, policies, or authorization behavior. The focused SQL/RLS suite passed after the fixture correction.
- Final `npm run verify:full` passed on `979412681e08ab4334c975c1591e65b7c9d0fe2f`: migrations reset/replayed; format/lint/typecheck/build, unit 96/96, integration 68 passed/1 skipped, SQL integration 11 files, RLS 7 files, Harness, security, agent eval 10/10, E2E 28/28, persistence/analytics, a11y 28/28, Storybook 6/6, and golden 3/3.
- Official CI run `37215008624` passed on the same SHA: Supply Chain, Database, Guardrail Simulations, Quality, Preview and CI Gate.
- Stage 02 feature is now `done / verified:true`; evidence: `harness/evidence/stage-02-operations/README.md`, `verification.json`, local full gate, and PR #33. PR remains open and unmerged for the user.
- Only untracked `artifacts/canonical-slice/*` and `artifacts/p21-foundation/*` remain; they were not added, moved, or changed by this work.
- The final-state Official CI run `37218336532` passed for `f1c8cab5fff4169b18f52f87c4eb46b0fd44addf`, including Preview and CI Gate; no merge is requested.

# 2026-10-04 — Stage 2.1 UX implementation handoff

- Implemented the Admin/Teacher operations presentation pass, shared operation tables/filters/metrics/overlays/schedule grid, responsive Cohorts/Enrollment/Lead/Student/Teacher surfaces, and calendar-style Teacher availability inputs. Added a bounded Admin Students visual projection migration and focused regression coverage.
- Focused checks observed green: format, lint, typecheck, build, 97 unit tests, 68 integration tests (1 existing skip), static DB contracts (26 migrations/17 invariants), SQL integration (12 files including concurrency), RLS (8 files), Harness, security, and agent eval (10/10). The Student directory projection migration applied successfully during a clean local Supabase reset/replay.
- Full E2E/a11y/visual verification remains incomplete. The first aggregate run could not bind port 3000 (`EACCES`); an isolated-port retry was interrupted at the user's request during database reset, before E2E started. An isolated Cohorts E2E reproduction also remained on the Admin loading fallback. `cohorts-booking.spec.ts` now navigates directly and waits for its cohort row; `admin-cohorts.spec.ts` restores canonical capacity after its assertion, but those final test adjustments have not been rerun.
- User requested stopping localhost and completing with a report. Stopped the verification-owned Supabase containers; confirmed no listener on ports 3000, 4001, or 4002. `git diff --check` passed. Existing untracked canonical-slice and P21 artifacts were preserved; no screenshot cleanup was performed.
- Stage 02 remains `done / verified:true`. Stage 2.1 remains `in_progress / verified:false` pending user-run E2E, a11y, visual, and remaining requested verification gates; Official CI was not run.

# 2026-10-04 — Stage 02.1 gate remediation and verified closure

- Reconciled the stale availability accessibility selector with the shipped `Data` / `Início` / `Término` controls; added Admin/Teacher overview focus+axe coverage. Official CI #530 subsequently passed the complete accessibility suite (30/30).
- Semantically reviewed Stage 2.1 shared operation primitives and consolidated them into existing `display.tsx`, `controls.tsx`, and `overlays.tsx`; removed the parallel `operations.tsx` and `operation-overlays.tsx` files. No changed file remains outside the machine-readable GOAL scope.
- Added a representative Operations Storybook story and visual coverage. Official CI #530 passed Storybook build, 7/7 design-system visual tests and 3/3 product golden tests.
- Removed unrelated generic canonical/P21 screenshot artifacts from the PR diff; task evidence now lives under `harness/evidence/stage-02-1-operations-ux/`.
- Official CI run `37245878022` passed Supply Chain, Quality, Database, Guardrail Simulations, Preview and CI Gate. Observed counts: unit 97/97; integration 68 passed + 1 existing skip; SQL integration 12 files; RLS 8 files; critical E2E final summary 27 passed with no failure; accessibility 30/30; Storybook visual 7/7; golden 3/3.
- `verify:agent` and `verify:full` were not re-invoked literally after the remediation commits. Their executable constituents were all green in Official CI #530, and the 10 `eval:agent` rules were deterministically reproduced against the current diff. `verification.json` records this distinction rather than fabricating wrapper execution.
- Stage 02 remains `done / verified:true`. Stage 02.1 is now `done / verified:true` with PR #34 and Official CI #530 as durable evidence. A final Official CI run on this committed Harness state is still required before merge; no merge is requested.

# 2026-10-04 — Student Home approved design refactor started

- Created `refactor/student-home-approved-design` from current main merge `58b9a3d85ed8a94fdde9b3f3839821128c3eaca4`.
- Frozen the existing Home architecture: Server Component page, one Learning/Practice/Schedule read each, concurrent application orchestration, current primary-action priority and independent partial/error states.
- Scope explicitly excludes shared Student shell/layout, server repositories, database, RLS/auth, fake streak/analytics/search/notifications, global overrides and visual-tolerance changes.
- Implementation has not yet been claimed verified; task remains `in_progress / verified:false`.

## 2026-10-04 — Student Home implementation pass

- Added only one application-model delta: `HomeLearningView.upcomingLessons`, bounded to three and derived from the already-loaded focused Learning course. Existing `lesson`, repository ports, concurrency and primary-action selection remain unchanged.
- Added unit coverage proving the projection starts at the selected/resumed lesson, is capped at three, and is empty for a completed course.
- Refactored only Student Home composition and `home.css` using existing Card/Badge/ProgressBar primitives and Yas tokens. StudentShell, shared layout, server adapters, DB/RLS/auth and global Design System were not modified.
- The approved screenshot is treated as visual direction only: no fake streak, fake weekly minutes, fake search, fake notification control or invented analytics was added.
- Verification is pending CI; no golden baseline has been updated and no success claim is made yet.

## 2026-10-05 — Student Home reviewed baseline promotion

- Continued from `16b2a94`; focused Home unit/integration tests passed 32/32.
- Reviewed Windows and actual Linux runner captures at all three required viewports, then promoted only six Home baselines. Complete Windows golden spec passed 3/3 with Login/Aulas/Progresso unchanged and tolerance 0.0015.
- Browser checks confirmed zero horizontal overflow, no framework error overlay and keyboard focus on the primary CTA at 1440x900, 834x1112 and 390x844.
- GOAL now declares the existing user-authorized `validate-upgrade.sh` correction; the scope eval rejected it before documentation and passed 10/10 afterward. No upgrade behavior changed.
- Final verification wrappers and Official CI remain pending; Student stays in_progress/verified:false and Admin has not started.

## 2026-10-05 - Latest verification and requested closeout

- Source `7f9715d123b54aa1f4ee151b99c2c1ef9eca9624` is pushed to the existing Student branch. Official CI 37317448834 passed all six mandatory jobs; PR #35 remains open without merge.
- Literal verify:agent and verify:ui passed, including 30 E2E, 30 a11y, seven design-system checks and three complete Windows golden projects. Only six Home baselines differ from main, with tolerance 0.0015 intact.
- Latest verify:full passed core, real SQL/RLS, Harness/security/eval, 30 E2E and persistence/analytics, but failed Teacher P21 desktop accessibility at the original 30-second scenario budget (29 a11y passed). Isolated reproduction and responsible-layer diagnosis remain pending. No full-green claim is justified.
- User requested finalization. Evidence is recorded without promoting registry status: Student remains in_progress/verified:false; final evidence-commit CI and all Admin implementation work remain pending.
