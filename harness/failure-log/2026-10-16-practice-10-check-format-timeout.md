# Failure - process-spawning unit tests exceed the default Vitest timeout on Windows

Classification: test gap  
Status: resolved  
Repeatable: yes  
Date: 2026-10-16  
PR/commit related: branch feat/practice-10-phase-0 (practice-10-v3)

## Symptom

`tests/unit/check-format.test.ts` failed with "Test timed out in 5000ms" in `verify:agent` twice and in `verify:full` once (5074 ms); after it was given its own timeout, `tests/unit/check-playwright-results.test.ts` failed the same way (5066 ms). Both pass alone.

## Evidence

`npm run verify:full` on 2026-10-16 stopped at `test:unit` with 1 failed / 331 passed; the only failure was this test at 5074 ms. The same test passed alone (`npx vitest run tests/unit/check-format.test.ts`, 1/1).

## Root cause

These tests spawn `git`, Node and Prettier processes. On this Windows machine (local Supabase stack, another dev server, nearly full disk), each spawn costs seconds, so whole tests land at 4–5 s, at the edge of Vitest's 5 s default timeout.

## Responsible layer

Test configuration.

## Immediate fix

`vitest.config.ts` sets `testTimeout: 20_000` for the unit/integration suites. No assertion changed.

## Permanent protection

A project-wide timeout that fits process-spawning suites on Windows, documented in the config, instead of per-test patches that leave the next spawning test exposed.

## Test/eval created

The existing spawning suites (`check-format.test.ts`, `check-playwright-results.test.ts`) inside the full `test:unit` run of `verify:full`.

## Reproduction

Run `npm run test:unit` on Windows with the local Supabase stack running; the test approaches or exceeds 5 s.

## Before/after proof

Before: 2026-10-16 `verify:full` failed at test:unit, check-format.test.ts timed out at 5074 ms.  
After: see the next `verify:full` run recorded in `harness/evidence/practice-10-v3/README.md`.
