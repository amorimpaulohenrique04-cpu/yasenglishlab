# Failure — Turbopack parses Google font URL parameters as separate entries

Classification: dependency  
Status: open  
Repeatable: yes  
Date: 2026-10-17  
PR/commit related: https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/pull/80

## Symptom

Preview visual failed compiling Montserrat before any visual tests could execute.

## Evidence

harness/evidence/pr80-gates/ci-before.md, font-repro-before.log, build-after.log; upstream Next #99114 and fix #100158.

## Root cause

Next 16.3.8 mishandles extensionless Google font URLs with ampersands inside serialized query data. A controlled Google CSS response reproduces the identical failure. CI jobs have independent builds and no shared Next cache.

## Responsible layer

Dependency font resolver and network-dependent build input.

## Immediate fix

Vendor the exact successful-build WOFF2 bytes and equivalent font-face rules, fallback metrics and Latin preloads. No bundler or font design change.

## Permanent protection

SHA-256 asset integrity and local font reference test, production builds and unchanged visual baselines.

## Test/eval created

tests/unit/font-assets.test.ts; controlled font reproduction and build logs in task evidence.

## Reproduction

Build a minimal Next 16.3.8 layout importing Montserrat with NEXT_FONT_GOOGLE_MOCKED_RESPONSES returning a font URL containing kit, skey and v query parameters.

## Before/after proof

Before: controlled build fails with next/font/google queries have exactly one entry, matching CI #703.
After: application build with the same local font bytes passes. Repeated clean/offline build and full visual equivalence still pending.
