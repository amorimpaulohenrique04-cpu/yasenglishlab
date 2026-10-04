# Harness Decisions

## H-001 — AGENTS.md is a map, not a second manual

Detailed product/engineering rules remain in `docs/`; `AGENTS.md` only routes an agent to the correct source and commands.

## H-002 — Deterministic checks use Node

Bash and PowerShell files are thin wrappers. Cross-platform verification logic lives in Node scripts so Windows, macOS and Linux evaluate the same rules.

## H-003 — Persistent state must not overclaim

A task can be `done` only with `verified: true` and non-empty evidence in `harness/feature_list.json`. Product features that do not exist are not pre-populated as done.

## H-004 — Behavioral evals complement automated checks

Some questions (for example duplicate UI semantics or scope justification) require contextual review. Automated scripts validate structural/security/database invariants; the behavioral rubric validates agent conduct and evidence quality.

## H-005 — Design tokens are the executable visual API

Yas colors, typography, spacing, radius, shadow, border, breakpoints, z-index and motion are exposed as CSS variables in `src/styles/tokens.css`, with a typed mirror in `src/styles/tokens.ts`. Future product screens should consume these tokens rather than introduce equivalent arbitrary values.

## H-006 — Prefer native semantics before adding interaction libraries

The current primitive layer uses native form controls and `dialog` semantics where they satisfy the contract. Tabs/Dropdown add only the keyboard behavior required by their semantics. A third-party primitive library should be introduced later only for a demonstrated accessibility/behavior gap, not preemptively.

## H-007 — Accessibility evidence is a blocking design-system gate

Storybook's accessibility addon remains enabled and the Playwright visual suite runs Axe against representative core/form/desktop/mobile stories. Serious accessibility findings block completion; rules are fixed at the component level rather than disabled for convenience.

## H-008 — Visual evidence proves primitives, not product pages

Design-system stories demonstrate states, hierarchy, responsiveness and layout primitives without recreating Home/Aulas/Prática or other product screens. Approved product screenshots remain the later page-level source of truth.

## H-009 — Repeatable failures become executable guards

A relevant repeatable failure is not considered resolved until it has permanent protection, a test/eval and red-to-green proof. ADR 0005 owns the durable rationale; `harness/ratchet.md` owns the operating loop so this file does not duplicate the full policy.

## H-010 — The local UI gate must equal the UI contract, not a subset

`npm run verify:ui` is the single local visual gate referenced by `AGENTS.md`. It must execute E2E, critical-flow accessibility, design-system visual checks and product golden regression tests; merely checking that test files exist is insufficient.

## H-011 — Engineering System 1.0 consistency is executable

`npm run verify:system` validates the cross-cutting surfaces that previously drifted silently: current README/module/style maps, complete engineering milestone registry, persistent plan consistency, full UI gate wiring, core CI/CD stages, RLS evidence, observability surfaces and Ratchet presence. Harness verification executes this contract so drift blocks CI.

## H-012 — Verification runners invoke npm through Node

Node verification scripts execute the npm JavaScript CLI with `process.execPath` and `process.env.npm_execpath`. They do not dispatch `npm.cmd` or enable a shell. This preserves arguments and executable paths across Windows and Linux, including paths containing spaces, while avoiding DEP0190 and shell parsing.

## H-013 — Git checkout policy owns canonical LF

`.gitattributes` defines `text=auto eol=lf` for repository text and excludes known binary assets. Formatter policy and checkout behavior therefore agree without relying on each developer's global Git configuration.

## 2026-09-30 — Teacher Operations V1

- `/teacher` is the canonical Teacher entry point; `/teacher/sessoes/[sessionId]` is the operational detail route.
- Teacher authorization is deliberately narrower than generic live-session RLS: every Teacher read/write derives the active teacher from `auth.uid()` and requires `private.has_role('TEACHER', true)`.
- Roster name access is exposed only through a minimal SECURITY DEFINER read model for the authenticated Teacher's own session; global profile RLS is not widened.
- Attendance writes remain unavailable as direct authenticated DML. `mark_teacher_attendance(uuid,text)` accepts only booking + ATTENDED/NO_SHOW and derives actor/teacher internally.
- Attendance audit is a trigger in the same PostgreSQL transaction as the upsert so audit failure cannot yield a reported successful attendance mutation.
- No temporal attendance window was invented. Only `session_bookings.status = 'BOOKED'` is enforced by V1.
- NO_SHOW remains operational only; no credit, billing, penalty, cancellation or entitlement consequence is introduced.
- Availability editing, cancellation/rescheduling, meeting provider, broad Teacher authoring and Admin CMS remain open/out of scope.
- Teacher UI reuses the official Design System primitives/tokens but has a dedicated shell instead of treating Teacher as Student.

## 2026-10-02 — Approved P21 foundation

ADRs 0007–0009 record role-aware workspaces, session-start Recife quotas and additive cohorts. Preserve historical migrations and original UUID booking RPC; the application uses the result RPC for durable quota denial audit. Preserve null-cohort sessions and direct Teacher assignments. Extend goal scope only for exact generated Next lint/format ignores after observed gate failure; no source checks removed. No provider decisions or P21.4/P22 work.

P21 final gate: Windows Home goldens predate P21 (f086e31); approved Linux Home was promoted in a4def7c. Home implementation/style has no diff against origin/main. Synchronize only the three inspected Windows Home images to the existing approved main UI; retain thresholds and all other baselines. This repairs stale platform evidence, without changing product visuals.

P21 Windows verification also revealed missing Progresso win32 references: main contains only three Linux images from aff4784. Golden test generated first Windows images, which were inspected against the Linux reference and unchanged main Progress code. Add these missing platform baselines without replacing existing images or changing thresholds.

## 2026-10-03 — Stage 01 dependency boundary and unpatched braces mitigation

- Stage 01 depends on the verified P21 P0 foundation (role routing, transactional booking quota and Cohorts) plus its transitive verified Assessment/Teacher/Auth foundations. It does not consume P21.4–P21.6 recorded-video/Mux behavior. The registry therefore points to `p21-p0-foundation-closure`; `p21-p1-core-experience` remains independently `in_progress / verified:false` until its real Mux requirement is proved.
- Official CI is blocked by GHSA-vfj7-8cjw-p6xm / CVE-2026-93687 in dev-only `braces@3.0.3`. No patched npm release exists as of 2026-10-03.
- Do not downgrade Next/ESLint, lower `audit-level`, or hide the advisory. Until upstream publishes a fixed release, apply the narrow source backport derived from reviewed upstream PR micromatch/braces#72, verify exact Git blob provenance and the 100/101 depth boundary, require a clean production-dependency audit, and allow the full dev audit to pass only when every reported high finding belongs to that exact patched advisory chain.
- Any new advisory, production-path finding, patch drift, upstream package-version drift or failed depth regression remains fail-closed.
