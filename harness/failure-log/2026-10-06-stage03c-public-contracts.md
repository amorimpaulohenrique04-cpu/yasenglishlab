# Stage 03C public projection and accessibility

Classification: ui contract

Status: resolved

Repeatable: yes

Date: 2026-10-06

PR/commit related: https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/pull/44 / 9bcd06c2111c0ffc9d8d2ad8bc8a287ad380e06f

## Symptom

The newly added landing CTA failed contrast and a nav link missed the 44px target. The public catalog initially rejected legacy PostgreSQL GUID seeds. Local E2E also encountered generated-cache ENOSPC.

## Evidence

Red evidence: canonical commercial E2E axe reported CTA foreground #32125f on #6d28d9, contrast 2.13:1. The new nav link selector overrode the approved Button's foreground. Scoped the rule to non-button links. The same axe checks at desktop/tablet/mobile passed after the correction; the canonical test remains a permanent guard. Linked evidence: harness/evidence/stage-03c-public-commercial-flow/README.md. PR pending.

A second deterministic projection failure was a strict RFC UUID validator against existing PostgreSQL seed IDs (10000000-0000-0000-0000-000000000001). No DB data was rewritten. z.guid validates the database identifier format; the focused integration fixture now uses that seed shape and passed. Auth and newly generated checkout UUID validation remains strict.

The permanent canonical guard also requires new interactive links to have 44px width/height. It caught the Entrar link at 41.84px width; scoped min-width and touch-link rules fixed it. The unchanged scenario then passed at every required viewport.

Environment interruption: the E2E screenshot write failed with ENOSPC while the same dev server emitted Turbopack SST persistence failures. Removed only regenerable workspace dev cache after stopping that server, then retried only this E2E. No wider environment repair or unrelated test investigation.

## Root cause

New nav color rule overrode the approved Button foreground; text link width depended solely on glyph width. The public projection's UUID schema was narrower than the actual PostgreSQL seed identifier format. Turbopack disk persistence consumed the remaining local disk space.

## Responsible layer

Stage 03C scoped presentation and server Plan projection. Disk interruption belongs to regenerable local verification artifacts.

## Immediate fix

Restrict nav foreground to non-buttons and apply 44px minimum target dimensions. Validate historical Plan IDs as PostgreSQL GUIDs. Stop the test server and clear only its workspace Turbopack cache.

## Permanent protection

The one canonical commercial E2E runs axe and target/responsive assertions at the required widths. The focused projection integration test includes an actual seed-shaped GUID; no authentication or checkout UUID validation is weakened.

## Test/eval created

tests/e2e/commercial.spec.ts and tests/integration/commercial.test.ts. Existing scripts/verify-ratchet.mjs also protects this record's mandatory metadata and proof structure; initial CI rejected the free-form record and it was corrected to TEMPLATE.md.

## Reproduction

The pre-fix nav selector produces axe contrast 2.13:1; the pre-fix Entrar link measures 41.84px. Strict RFC UUID parsing rejects 10000000-0000-0000-0000-000000000001. Run the corresponding focused tests against each pre-fix version to reproduce.

## Before/after proof

Before: canonical E2E failed axe contrast, then 44px target assertion; public projection with seeded GUID returned no plans due to schema rejection. Official CI run 37492306733 rejected the missing ratchet metadata/sections.

After: final local canonical E2E passed in 26.0s with nine accessibility/responsive/target checks and six screenshots. The projection integration test with the seed-shaped GUID passed. The same existing ratchet validator is executed after record correction; Official CI remains the final authority.

Official CI proof: https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/actions/runs/37492862994 passed all gates on eb4beabd31ef752cfb453da967464872c0105072, including ratchet, the canonical commercial E2E, accessibility, production build and Preview. No functional test or invariant was weakened.
