# Evidence — prompt-17-teacher-operations-v1

Status: passed — implementation, security, persistence, accessibility, visual and Official CI evidence inspected.

## Baseline

- Base branch: `main`
- Base SHA: `a77386df147805f8ecd236f63657c90d251b3c63`
- Working branch: `feat/teacher-operations-v1`
- Pull request: https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/pull/21
- Final verified implementation head before Harness closure: `30bd79874cf7a05218f5ce1f2fa5f67c88f22b6b`
- PR remains open and unmerged.

## Implemented evidence surfaces

- Migration: `supabase/migrations/20261001030000_teacher_operations_v1.sql`
- DB/RLS evidence: `supabase/tests/teacher_operations.sql`
- Unit: `tests/unit/teacher-operations.test.ts`
- Application integration: `tests/integration/teacher-operations-application.test.ts`
- E2E: `tests/e2e/teacher-operations.spec.ts`
- A11y: Teacher flow in `tests/a11y/critical-flows.spec.ts`
- Real MFA helper: `tests/helpers/teacher-mfa.ts`
- Runtime fixture: `scripts/setup-canonical-e2e.mjs`
- Persistence/audit postcondition: `scripts/assert-canonical-e2e.mjs`
- Security ratchet: `scripts/verify-security.mjs`
- DB ratchet: `scripts/verify-db.mjs`

## Security and authorization evidence

Executable DB/RLS and browser evidence proves:

- STUDENT denied.
- SUPPORT without TEACHER denied.
- ADMIN without TEACHER denied.
- TEACHER AAL1 denied.
- TEACHER AAL2 allowed.
- Multi-role TEACHER + ADMIN remains Teacher-scoped inside Teacher Operations.
- Teacher identity is derived from `auth.uid()`; read/mutation RPCs do not accept caller-supplied teacher or actor identity.
- Teacher A cannot read or mutate Teacher B session/roster/attendance, and vice versa.
- Broader pedagogical profile context remains assignment-scoped.
- Roster contract excludes email, phone, user id, subscription, billing, entitlement, assessment and meeting data.
- Direct authenticated INSERT/UPDATE on `attendance` remains denied.
- Only `ATTENDED` and `NO_SHOW` are accepted for an active BOOKED participant in the authenticated Teacher's own session.
- Attendance retries/corrections reuse one unique persisted row.
- `marked_by_user_id` derives from the authenticated Teacher.
- Attendance audit is transaction-coupled and records actor, attendance, session, booking and resulting state without forbidden secret/PII categories.
- NO_SHOW has no invented commercial consequence.

## MFA correction evidence

Verification exposed two pre-existing local/browser MFA issues and corrected them without weakening AAL2:

- Local/Preview Supabase TOTP enrollment/verification was disabled; `supabase/config.toml` now enables TOTP only for the local verification stack.
- Incomplete TOTP enrollment could leave an unverified factor and Strict Mode could race preparation. `src/app/mfa/mfa-panel.tsx` now cleans unverified TOTP factors from `listFactors().data.all` and aborts stale effects before enrollment.
- Official CI #300 subsequently completed the real AAL1 → TOTP → AAL2 browser flow successfully.

## Official CI

Final implementation verification:

- Official CI run: https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/actions/runs/36816618361
- Run number: `300`
- Conclusion: `success`
- Supply Chain: success
- Quality: success
- Database: success
- Guardrail Simulations: success
- Preview: success
- CI Gate: success

Preview evidence observed in run #300:

- Real DB integration + booking concurrency: passed.
- RLS suite: passed.
- Intentional observability probe: passed.
- Critical E2E: 5/5 passed.
- Post-E2E persistence and analytics: passed; log printed `Canonical E2E persistence and analytics evidence passed.`
- Accessibility: 12/12 passed.
- Storybook build: passed.
- Design-system visual checks: 6/6 passed.
- Product golden visual checks: 3/3 passed.

## Preview artifact and visual inspection

- Artifact ID: `11142120950`
- Artifact: https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/actions/runs/36816618361/artifacts/11142120950
- SHA-256: `3edba2c1deaca02790e34f567950e88456d037346e47ebde6b60474c3a53c865`
- Merge-ref artifact name: `preview-evidence-294b5bddf1c3746bae15cdf03ae708153b3a2432`

Teacher screenshots were downloaded and manually inspected:

- `artifacts/canonical-slice/teacher-desktop.png`
- `artifacts/canonical-slice/teacher-tablet.png`
- `artifacts/canonical-slice/teacher-mobile.png`

Observed visual result:

- Desktop lists Teacher-scoped sessions cleanly without exposing roster details on the index.
- Tablet and mobile show the Teacher Ops session, persisted `Presente` badge, success feedback, participant roster and Present/Absent controls.
- Responsive composition has no visible clipping/overflow in the inspected captures.

## Failure history retained

The verification history was fail-closed rather than bypassed:

- Earlier DB audit assertion relied on temporal/UUID ordering; it was replaced by a semantic transition assertion.
- Run #282 exposed local TOTP being disabled.
- Later retries exposed stale/unverified MFA factor recovery.
- Attendance E2E exposed an ambiguous `Presente` locator; it was scoped to the participant status badge.
- Post-E2E evidence exposed Data API/RLS ambiguity for privileged attendance/audit inspection; final Teacher persistence evidence is read directly from the same PostgreSQL system of record via `DATABASE_URL`.
- Formatting failures were corrected without weakening tests.
- Run #300 is the first full end-to-end closure run with every mandatory gate green.

## Final scope/privacy audit

The final PR diff was reviewed against the P17 allowlist. Changed files remain limited to Teacher Operations, explicit MFA/browser exceptions recorded in the GOAL, test/CI harness wiring, relevant documentation and the single append-only P17 migration.

No unrelated billing editor, Practice/CEFR feature, cancellation/rescheduling, credit/no-show commercial policy, meeting provider, Admin CMS, Teacher authoring, availability CRUD, historical migration edit or global authorization widening was introduced.

## Closure

Teacher Operations V1 is verified. Durable closure record: `harness/evidence/prompt-17-teacher-operations-v1/verification.json`.

PR #21 remains open and unmerged, as required.
