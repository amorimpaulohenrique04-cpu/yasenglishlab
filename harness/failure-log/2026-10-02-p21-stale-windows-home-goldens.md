# P21 stale Windows Home visual evidence

Classification: ui contract
Status: resolved
Repeatable: yes
Date: 2026-10-02
PR/commit related: https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/pull/30

## Root cause

Windows Home snapshots last changed in f086e31 before P21; Linux snapshots were inspected/promoted in a4def7c. All three Windows expectations show the old Home. Home code and styles have no diff against main 94b574b40b8b05ed798f996294d2297ba92b5e31. Current actual images match approved Linux P21 content and structure.

## Immediate fix

Synchronize only three inspected Windows Home snapshots. Keep all other expectations, pixel thresholds, application Home and visual assertions intact.

## Permanent protection

Existing strict golden tests verify current approved Home across all three viewports.

## Test/eval created

Existing golden suite and final UI/full gates.

## Before/after proof

Before: three failures compare P21 Home with pre-P21 Windows images.

After: literal verify:ui passed all three strict golden projects, 14 E2E, 16 a11y and six design-system checks. All screenshot thresholds remain unchanged.

## Symptom

Final gate rejected the recorded failure condition described above.

## Evidence

See harness/evidence/p21-p0-foundation-closure/verify-full.log and verify-ui.log.

## Responsible layer

Local verification environment and platform evidence.

## Reproduction

Run the final literal verification alias as described above.

Progress follow-up: main aff4784 includes only Linux Progresso baselines; first Windows execution reports missing snapshots and writes actual. Inspect and add the three missing Windows references against unchanged main Progress code and approved Linux images. Strengthen verify-ui to require Progress alongside Login/Home/Aulas on both platforms. Existing references and tolerances stay intact.
