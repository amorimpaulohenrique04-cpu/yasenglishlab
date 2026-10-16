# Evidence — practice-10-phase-0

Date: 2026-10-16. Branch `feat/practice-10-phase-0` (base `c98a33d`).

## SQL (isolated test stack 55422)

- `node scripts/run-sql-tests.mjs practice-lifecycle` — PASS (gating matrix, assignment bypass, resume within 24h, stale -> ABANDONED, duplicate cleanup, partial unique index, ABANDONED cannot be submitted, `student_practice_reach` scope).
- `practice-authoring`, `access-closure` — PASS after adaptation (seeded practices are linked to lesson 2; fixtures now record lesson-2 progress first; no assertion removed).
- `function-privileges`, `record-immutability` — PASS (reported by yas-database).

## App tests

- `npx vitest run tests/unit/practice.test.ts tests/unit/practice-grouping.test.ts tests/integration/practice-application.test.ts` — 13 passed.
- `npx tsc --noEmit -p .` — no errors. eslint/prettier on changed files — clean.

## Live checks (dev stack 55321, migration applied with `supabase migration up`, dev server on :3100)

- `start_practice_attempt` via PostgREST as `student.dev@example.test`:
  - lesson-2 activity -> `{"code":"YP001","hint":"PRACTICE_LESSON_NOT_REACHED","message":"Practice lesson not reached"}`.
  - reachable activity started twice with different idempotency keys -> same attempt id `380ba006-…` (resume).
- `/pratica`: lesson-2 group shows "Disponível quando você chegar a esta aula", tiles read "Libera quando você chegar a esta aula" with no start button; featured block is the reachable "Prática livre"; heading "Pratique o conteúdo do curso"; summary "≈ 0 min estimados nos últimos 7 dias".
- `/pratica/[attemptId]`: progress no longer inside `aria-hidden`; `role="progressbar"` with label "Avanço nas atividades da aula", text "Atividade 1 de 1".

## Known environment notes

- The app on :3000 is the PR 74 demo (`artifacts/pr74-local/start-demo.mjs`, stack 55621); it was not migrated or modified.
- On the dev stack the Student has no active cohort, so lesson progress cannot be saved from the UI; the resume/gating proof above used the RPC directly.
- Dev stack has a fixture activity `82600000-0000-0000-0000-000000000001` whose id is not an RFC 4122 UUID; the start form's zod schema rejects it (pre-existing, unrelated to this change).
- Disk C: ran out of space during verification; regenerable caches `.next` and `.next-p18-build` were removed with user approval.
