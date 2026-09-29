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
- ESLint 10.11.0 with Next.js flat config.
- Prettier 3.9.0 as the formatter.
- Vitest 5.0.0 for unit/integration tests.
- Playwright 1.63.0 for E2E.
- Storybook 10.6.0 using `@storybook/nextjs-vite`.

Top-level runtime/tooling versions are pinned. A committed npm lockfile pins transitive dependencies.

TypeScript 5.9.3 is deliberately retained instead of adopting TypeScript 7 in the foundation. Next.js supports TypeScript 5+, and 5.9 is a mature baseline across the selected tooling. A TypeScript major upgrade can be evaluated later through an explicit ADR with real compatibility evidence.

## Alternatives
- TypeScript 7 immediately: newer compiler generation, but unnecessary migration risk before product code exists.
- Storybook Webpack framework: supported, but Storybook recommends the Vite-based Next.js framework for modern projects.
- Custom formatter/linter stack: rejected because ESLint + Prettier is mainstream and explicitly supported by Next.js.
- Node 20: rejected because current Supabase JavaScript libraries have ended Node 20 support.

## Consequences
- Contributors need Node 24.
- Tooling versions move only through reviewed dependency updates.
- No product feature is implied by this stack decision.
- A future dependency/CI task can add automated upgrade/security policy.

## Evidence
See official release/support references recorded in the PROMPT 02 pull request and repository documentation.
