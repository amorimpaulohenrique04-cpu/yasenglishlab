# Failure - Practice starts a new attempt instead of resuming the open one

Classification: state  
Status: resolved  
Repeatable: yes  
Date: 2026-10-16  
PR/commit related: branch feat/practice-10-phase-0 (practice-10-phase-0)

## Symptom

On `/pratica` as `student.dev@example.test`, "Histórico recente" lists six entries, all "Em andamento" and dated 16 Oct, four of them "Canonical Speaking Review". An external UX review (GPT) read this as possible duplicate records or a sync error between the history and "3 atividades concluídas".

## Evidence

- Live page (localhost:3000, 2026-10-16): the six history links point to six distinct attempt ids (`/pratica/7b67130c…`, `/pratica/1c2a6e9b…`, `/pratica/9b3f5a74…`, `/pratica/3548f27c…`, `/pratica/46457522…`, `/pratica/3b0a01b7…`). They are separate rows, not duplicated rendering.
- `src/app/(protected)/(student)/pratica/_practice/start-practice-form.tsx:23` renders `idempotencyKey = randomUUID()` on every server render, so each new page load + "Praticar" click is a new key.
- `start_practice_attempt` (`supabase/migrations/20261014120000_stage_11_access_closure.sql`) only dedupes on `(user_id, idempotency_key)`; it never looks up an existing `IN_PROGRESS` attempt for the same activity.
- No code path sets `ABANDONED` (only the enum and the "Interrompida" label exist: `src/modules/practice/domain/models.ts:324`), so open attempts never leave `IN_PROGRESS`.
- No real inconsistency with the summary: `history.slice(0, 6)` (`src/modules/practice/application/queries.ts:72`) shows the six most recent attempts by `started_at`; the three SUBMITTED attempts counted in "Resumo da semana" are older than those six.

## Root cause

Starting a practice is idempotent per click, not per activity. Leaving a practice without submitting and starting it again from another render creates a new open attempt; nothing resumes, expires or abandons the previous one. The history then fills with "Em andamento" rows that hide completed work.

Contributing (environment): "Canonical Speaking Review" is an E2E fixture (`scripts/setup-canonical-e2e.mjs:313`, slug `canonical-speaking-review`) published in the same course the dev student sees, so its technical title shows up as student content in local dev.

## Responsible layer

Application/database boundary (practice start command and `start_practice_attempt` RPC). The fixture title is a dev-environment/seed concern, not production content.

## Immediate fix

Migration `supabase/migrations/20261016120000_stage_13a_practice_lifecycle.sql`: duplicate IN_PROGRESS attempts become ABANDONED (latest kept); `start_practice_attempt` resumes an open attempt touched in the last 24h and abandons older ones; partial unique index `practice_attempts_one_open_per_kind`. Commit: practice-10-phase-0.

## Permanent protection

Partial unique index on (user_id, practice_activity_id, attempt_kind) where status = IN_PROGRESS, plus resume/expiry logic inside the RPC under a per-(user, activity) advisory lock.

## Test/eval created

`supabase/tests/practice_lifecycle.sql` (suite `practice-lifecycle`): resume within 24h with a different key, stale attempt abandoned, duplicate cleanup, unique index rejects a second open attempt, ABANDONED cannot be submitted.

## Reproduction

1. Sign in as `student.dev@example.test`, open `/pratica`.
2. Click "Praticar" on any activity, go back without submitting.
3. Reload `/pratica` and click "Praticar" on the same activity again.
4. "Histórico recente" shows two "Em andamento" rows for that activity with different attempt ids.

## Before/after proof

Before: 2026-10-16 live page shows six distinct open attempts (four for the same activity) in the history.  
After: 2026-10-16 `practice-lifecycle` PASS; via PostgREST as `student.dev@example.test`, two starts with different idempotency keys returned the same attempt id `380ba006-…` (`harness/evidence/practice-10-phase-0/README.md`).
