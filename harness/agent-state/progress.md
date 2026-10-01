# Progress Log

Append-only task milestones. Do not rewrite history to hide failed attempts.

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
