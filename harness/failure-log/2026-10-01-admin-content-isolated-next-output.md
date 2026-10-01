# Failure — Admin Content verification shared Next output

Classification: environment  
Status: resolved  
Repeatable: yes  
Date: 2026-10-01  
PR/commit related: current change — prompt-18-admin-content-v1

## Symptom

The first aggregate verification overlapped a development server used by the Admin browser test. The build read partially written generated route types from `.next/p18` and TypeScript reported an unterminated template literal.

## Evidence

`npm run verify:agent` reached its build step after format, lint, typecheck, unit, integration and static DB checks, then failed on generated files under `.next/p18/dev/types/`. The Admin MFA/browser log also showed a closed stream while this overlap occurred.

## Root cause

The isolated browser run and the build used the same custom `distDir`, so they could write generated Next output concurrently.

## Responsible layer

Local verification infrastructure.

## Immediate fix

`next.config.ts` now keeps the isolated development server in `.next-p18` and its non-development build in `.next-p18-build`, using the documented Next development phase. These directories are siblings of the default `.next`, avoiding nested output that can leave partial generated types on Windows. The stale local isolated output was removed only after resolving and validating its exact paths.

## Permanent protection

The phase-specific output path prevents a build from sharing generated files with the browser server. Isolated Playwright runs also refuse to reuse a process on their dedicated port 3100, so a stale process cannot silently serve a different runtime; normal developer runs retain their existing reuse behavior.

## Test/eval created

The focused Admin E2E and a11y commands pass using the isolated development output; a standalone TypeScript check passes after the configuration change. The broader aggregate gates are intentionally deferred to the operator.

## Reproduction

Start the isolated Playwright development server and run an isolated build against its old shared `.next/p18` directory concurrently.

## Before/after proof

Before: generated route types were truncated during `verify:agent`.

After: focused Admin browser checks pass using the phase-specific directory and `node node_modules/typescript/bin/tsc --noEmit` completes successfully.
