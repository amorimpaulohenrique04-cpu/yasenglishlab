# Failure — Screenshot open on tracked evidence PNGs

Classification: environment
Status: open
Repeatable: yes
Date: 2026-10-24
PR/commit related: `codex/teacher-sessions-redesign`

## Symptom

Screenshot capture failed while opening tracked evidence PNGs.

## Evidence

`admin-plans-alerts`, `teacher-sessions-redesign` and `teacher-practices` reached screenshot capture and failed opening existing PNG destinations under `harness/evidence`. Error-context records show `UNKNOWN: unknown error, open`. Read-only diagnosis found destination paths 127–139 characters, existing writable files, and successful exclusive opens later. No Defender controlled-folder-access event 1123/1124 was found in the checked interval. A transient external file lock remains a hypothesis; antivirus is not a proven cause.

## Root cause

The OS rejected opening existing destinations. A transient external file lock is plausible but remains unproved. The test design coupled runtime capture to overwriting reviewed evidence.

## Responsible layer

Environment/file I/O; the runtime capture destination belongs to the test harness.

## Immediate fix

The tests directly overwrote reviewed, tracked PNGs. `tests/helpers/capture-screenshot.ts` now captures bytes, writes a unique file under `artifacts/e2e/captures` and attaches it to Playwright. The three affected specs use it. Reviewed evidence is promoted explicitly after a run. No Windows security settings were changed and write failures still fail the test.

## Permanent protection

Unique runtime-only capture files avoid overwriting historical PNGs; write errors propagate and fail the test.

## Test/eval created

`tests/unit/capture-screenshot.test.ts` covers repeated capture uniqueness, runtime-only paths, preserved screenshot failure and controlled `UNKNOWN` write failure.

## Reproduction

Run the three affected production E2E specs; the original environmental lock is transient. The unit write-failure case deterministically simulates `UNKNOWN` from the file write without changing OS security settings.

## Before/after proof

Before: historical error-context records of `UNKNOWN` opening tracked PNG destinations. After: all three capture-helper unit cases passed (including simulated UNKNOWN write failure). Both production Admin scenarios passed, all 22 Sessions captures completed before an unrelated aggregate timeout, and the full Teacher-practices scenario passed in a focused rerun (case 2.2 min; runner 5.3 min) without capture errors. The original external cause remains unproved; the record stays open pending the final official suites. No Windows security setting was changed.
