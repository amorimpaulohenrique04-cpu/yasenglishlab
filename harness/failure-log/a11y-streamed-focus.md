# A11y streamed focus and Teacher loading semantics

Date: 2026-10-03
Primary classification: test gap
Status: resolved within requested a11y scope

## Reproduce / capture / root cause
Five original failures preserved under harness/evidence/a11y-five-failures/original/.
Natural Chromium observations and controlled slow-frame observations are recorded in dom-before.json and dom-slow-frame.json. Hidden S:0 controls remain connected but cannot receive native focus. Once React reveals them, the same controls receive focus and native Tab reaches the expected adjacent controls. No hydration errors, redirects, disabled/inert states or remount were observed.
TeacherLoading independently gives a generic div a prohibited accessible name. Exact error-context/source match and isolated Chromium Axe reproduction are in axe-before.json.

## Smallest structural fix / permanent protection
TeacherLoading uses role=status with its existing name/busy semantics. Existing Teacher P21 WCAG Axe coverage stays enabled.
Placement tests assert initial control visibility before focus; all original focus and keyboard assertions remain. These visibility assertions permanently gate interaction on the actual streamed content, without sleeps, force, extra timeouts or retrying focus.

## Red / green proof
Red: original five error-context files and pre-change probes. Green: single authorized npm run test:a11y execution exited 0, 28 passed / 0 skipped / 0 failed (4.0m), including desktop/mobile Placement and Teacher P21 Axe.

## Scope / outstanding work
No RLS, migrations, dependencies, workflow or verified flags changed. No commit/PR is authorized. Broader verification remains deferred by user instruction.
