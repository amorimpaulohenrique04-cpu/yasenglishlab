# Failure — PDF font embedding and wrapping

Classification: dependency
Status: resolved
Repeatable: yes
Date: 2026-10-22
PR/commit related: teacher-sessions-redesign

## Symptom

PDF generation with the UI WOFF2 font timed out and raised an out-of-range fontkit subsetting error. Replacing the font exposed slow character-by-character width measurement.

## Evidence

Focused PDF test: first run failed after 65 seconds with fontkit TTFSubset._addGlyph RangeError; static-font run exceeded the existing 20-second test limit.

## Root cause

The PDF fontkit subset path is incompatible with the UI font. Repeated layout of every partial line also multiplied shaping work.

## Responsible layer

Server PDF generation.

## Immediate fix

Embed licensed static Noto Sans TTF; wrap by words using cached width measurements and split only oversized words.

## Permanent protection

Keep the multipage, accented, long-title export test at the existing timeout. Inspect rendered output before completion.

## Test/eval created

tests/integration/session-report-pdf.test.ts

## Reproduction

Run the focused PDF integration test with the UI WOFF2 font and original per-character width loop.

## Before/after proof

Before: two focused runs failed at the original timeout; the first also reported the fontkit RangeError.
After: focused PDF test passed in 4.63 seconds total runner time (2.5 seconds in test); corrected PDF + domain suite passed 7 tests. Generated five-page A4 artifact and visually inspected first/last pages with Poppler. Evidence: harness/evidence/teacher-sessions-redesign/report-{first,last}-page.png and focused-tests.log.
