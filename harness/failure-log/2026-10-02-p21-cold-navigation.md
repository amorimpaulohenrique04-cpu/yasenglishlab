# Failure — cold development navigation measured before response

Classification: environment
Status: resolved
Repeatable: yes
Date: 2026-10-02
PR/commit related: https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/pull/30

## Symptom

Fresh full verification failed Admin preview URL and first empty-Student login URL after five seconds. Both flows passed earlier UI/full browser runs; no application HTTP/auth assertion changed.

## Evidence

Final full attempt reached all real SQL/RLS and security checks, then Admin remained on saved module list and empty Student remained on login during cold requests. All following application E2E passed. See verification history in progress and final logs.

## Root cause

URL measurement began before login POST completed or the new dynamic preview route was compiled by next dev.

## Responsible layer

Playwright orchestration against cold development server.

## Immediate fix

Await the actual login POST response and assert successful status, then retain the original five-second navigation check. Prewarm Admin preview through the authenticated browser context and require HTTP 200 before measuring the UI link navigation.

## Permanent protection

Strict HTTP checks reject actual auth/route errors. No retry, fixed sleep, reduced assertion or increased URL timeout is introduced.

## Test/eval created

Existing Admin publication and canonical learning E2E now assert network completion/boundary as well as UI navigation and persistence.

## Reproduction

Run literal verify:full with a cleared isolated development cache.

## Before/after proof

Before: five-second URL mismatch on cold Admin preview and empty Student login.

After: repeated full verification passed all 14 E2E including both cold-route cases, and all following stages. See verify-full.log.
