# ADR-0001 — Engineering foundation stack

Status: accepted  
Date: 2026-09-28

## Context

The Yas English Lab repository needs a reproducible, agent-friendly web foundation before product features are implemented. The stack must favor current stable releases, explicit server/client boundaries and mainstream tooling with strong Next.js support.

## Decision

Use:

- Node.js 24 LTS as the development/runtime baseline.
- Next.js 16.3.6, the current Active LTS/security-patched line at the time of this decision.
- React/React DOM 19.3.0.
- TypeScript 5.9.3 with strict checking.
- Tailwind CSS 4.3.0.
- Supabase JS 2.117.2; PostgreSQL/Supabase schema remains unimplemented in this phase.
- ESLint 9.39.5 with Next.js flat config.
- Prettier 3.9.0 as the formatter.
- Vitest 5.0.0 for unit/integration tests.
- Playwright 1.63.0 for E2E.
- Storybook 10.6.0 using `@storybook/nextjs-vite`.

Top-level runtime/tooling versions are pinned. A committed npm lockfile pins transitive dependencies.

TypeScript 5.9.3 is deliberately retained instead of adopting TypeScript 7 in the foundation. Next.js supports TypeScript 5+, and 5.9 is a mature baseline across the selected tooling. A TypeScript major upgrade can be evaluated later through an explicit ADR with real compatibility evidence.

ESLint 10.11.0 was evaluated first but rejected for this foundation after a clean GitHub Actions run reproduced an upstream incompatibility in the React linting stack used by `eslint-config-next`: `eslint-plugin-react` still calls `context.getFilename()`, which ESLint 10 removed. ESLint 9.39.5 is the latest v9 patch line and preserves the Next.js recommended config without patching third-party packages. The project should move to ESLint 10 only after the upstream React plugin/config stack is compatible.

## Alternatives

- TypeScript 7 immediately: newer compiler generation, but unnecessary migration risk before product code exists.
- ESLint 10.11.0 immediately: current major, but the Next/React lint stack crashes before linting source files; patching dependencies locally would make the foundation less healthy.
- Removing Next/React rules to keep ESLint 10: rejected because version novelty is less valuable than retaining the framework's recommended lint coverage.
- Storybook Webpack framework: supported, but Storybook recommends the Vite-based Next.js framework for modern projects.
- Custom formatter/linter stack: rejected because ESLint + Prettier is mainstream and explicitly supported by Next.js.
- Node 20: rejected because current Supabase JavaScript libraries have ended Node 20 support.

## Consequences

- Contributors need Node 24.
- ESLint remains on the v9 maintenance line until its React/Next dependency chain is ESLint 10 compatible.
- Tooling versions move only through reviewed dependency updates.
- No product feature is implied by this stack decision.
- A future dependency/CI task can add automated upgrade/security policy.

## Evidence

- GitHub Actions reproduced the ESLint 10 crash in the real repository before any product code was implemented.
- Upstream `eslint-plugin-react` issue #4018 documents the same `contextOrFilename.getFilename is not a function` failure under ESLint 10.
- ESLint 9.39.5 is the published v9 patch line used as the compatibility fallback.
- Other official release/support references are recorded in the PROMPT 02 pull request.
