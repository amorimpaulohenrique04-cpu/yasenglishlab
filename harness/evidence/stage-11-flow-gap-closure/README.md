# Etapa 11 — flow gap closure: evidence

Status: in_progress / verified:false. Local checks passed; the Official CI run is pending.

Goal: `harness/goals/stage-11-fechamento-fluxo.md`. Decisions: `harness/agent-state/decisions.md` (2026-10-13). ADRs 0017, 0018, 0019.

## Scope checklist

- [x] `private.has_paid_access` is fail-closed (no subscription is no longer access); explicit grants; a scheduled cancellation stops granting once its end is reached.
- [x] `complimentary_access_grants` with ADMIN+AAL2 audited RPCs; deterministic `LEGACY_BACKFILL`.
- [x] Practice scoped by enrollment, in RLS and in `start_practice_attempt`. An attempted activity stays readable as history.
- [x] `confirm_placement_choice` accepts CANCELLED with a future paid end.
- [x] Automatic COMPLETED enrollment; read and progress access kept for COMPLETED (`private.has_course_enrollment`).
- [x] `admin_enrollments_without_active_cohort`, plus an Admin card on `/admin/enrollments`.
- [x] TS mirror (`deriveSubscriptionAccess`) with `NO_SUBSCRIPTION`, grants and scheduled-cancellation parity.
- [x] `/support` (guidance only); suspension notice on `/progresso`; "Curso concluído" on Home and Progresso; Admin grant/revoke block.
- [x] `.github/workflows/notifications-cron.yml` (no third-party actions, fail-closed) and the operator runbook.
- [x] ADRs, domain docs, OPEN_QUESTIONS, failure-log and ratchet.
- [ ] Official CI (Database, Quality, Preview: E2E/a11y/visual, CI Gate) on the PR head.
- [ ] Browser verification of the new UI. It was not possible locally (no Docker/Supabase) and is covered by the CI Preview job.

## Local results (2026-10-14, Windows, temporary Postgres 127.0.0.1:54329, synthetic auth bootstrap from `scripts/ci/validate-migrations.sh`)

| Check                                                                                                                                                                                                                                                                                     | Result                          |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| All migrations and seed on a clean DB, plus a seed replay                                                                                                                                                                                                                                 | PASS                            |
| Every `supabase/tests/*.sql` on a clean DB                                                                                                                                                                                                                                                | 30/30 PASS                      |
| `run-sql-tests.mjs` `rls`, `access-closure` (109 assertions), `subscription-access`, `subscription-cancellation`, `enrollment-integrity`, `function-privileges`, `sensitive-tables-negative`, `students-directory`, `admin-cohorts`, `admin-billing-operations`, `live-booking-integrity` | PASS                            |
| Concurrency scripts: schedule, core-experience, placement, billing webhook, notification delivery, new course completion (3 runs)                                                                                                                                                         | PASS (see notes)                |
| `check-migrations.mjs` with `BASE_SHA=origin/main`                                                                                                                                                                                                                                        | PASS (39 migrations)            |
| `vitest run tests/unit tests/integration`                                                                                                                                                                                                                                                 | 490 passed, 1 pre-existing skip |
| `tsc --noEmit`, `eslint .`, Prettier on changed files                                                                                                                                                                                                                                     | PASS                            |
| `verify-harness`, `verify-ratchet`, `verify-db`, `check-repo-policy`                                                                                                                                                                                                                      | PASS                            |

Notes:

- The notification and billing-webhook concurrency scripts use `set role service_role` on `auth.users`. The local synthetic bootstrap does not grant `service_role` usage on schema `auth` (CI runs them on real Supabase via `supabase start`), so the grant was added on the temporary database only. No repository change was made.
- `supabase/tests/rate_limit.sql` failed once at 00:00–00:01 and passed at 00:01:28. That is a pre-existing Etapa 7b defect, unrelated to this change. The rate-limit counter key does not include the window length, so 60 s and 3600 s windows collide on the hour. It was recorded as a separate follow-up task.

## Failure reproduced and closed

`harness/failure-log/2026-10-13-stage-11-no-subscription-open-access.md`:

- Before (migrations up to `20261014110000`): a STUDENT without a subscription or enrollment saw 4 activities and started an attempt.
- After: 0 visible activities and `42501 Practice activity is unavailable`.

## Test changes required by approved decisions (not dilution)

- `tests/unit/subscription-access.test.ts` and `tests/integration/subscription-gate.test.ts`: "no subscription ⇒ ok" became "no subscription ⇒ suspended NO_SUBSCRIPTION". Grant, expiry, revocation and scheduled-cancellation cases were added.
- `tests/unit/subscription-suspension-ui.test.ts`: the PAST_DUE notice now has exactly one link, to the internal `/support` page, and no external channel. A NO_SUBSCRIPTION case was added.
- `tests/e2e/canonical-slice.spec.ts`: the unpaid Student now asserts the first-checkout notice on Home, Prática and Progresso instead of the Practice fallback, which requires an enrollment now. The fallback stays covered in `tests/unit/home-projection.test.ts`.
- `tests/e2e/recorded-video.spec.ts`: the denied Student is the legacy-granted Home-now fixture (paid access, no enrollment), so the enrollment-level denial is still what is exercised.
- SQL fixtures in existing suites gained explicit grants or subscriptions for enrolled Students. No assertion was removed.

## Official CI

Pending: PR link and run id to be recorded here.
