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
