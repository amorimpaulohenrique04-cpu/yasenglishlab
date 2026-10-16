# Practice v3 — multi-question practices, per-item feedback and spaced review

Contract for `practice-10` phases 1–4 (plan: `C:\Users\PAULO HENRIQUE\.claude\plans\crie-um-plano-para-serialized-umbrella.md`). The database and the app are built in parallel against this file; change it first if the contract must change.

Decisions: A (assignment bypasses lesson gating), B (round 1 shows verdict + explanation, never the answer key; the key is shown after round 2 or a skip), C (resume within 24h), D (WRITTEN/SPOKEN items are not scheduled). See `harness/agent-state/decisions.md`.

## 1. Content v3 (`practice_activities.content`)

```
{
  version: 3,
  objective: string (1..200),            // "Ao final você consegue…"
  askConfidence: boolean,                // ask LOW/HIGH confidence per objective item
  instructions?: string (..600),
  evaluationMode: "DETERMINISTIC" | "MANUAL_PENDING",  // derived: MANUAL_PENDING if any item is WRITTEN/SPOKEN
  items: [ (1..20, unique ids)
    {
      id: /^[a-z0-9-]{1,40}$/,
      prompt: string (1..600),
      stimulus: v2 stimulus (NONE | TEXT | IMAGE | AUDIO | VIDEO),
      response: v2 response (CHOICE_SINGLE | CHOICE_MULTI | TRUE_FALSE | CLOZE | ORDERING | WRITTEN | SPOKEN),
      planningSeconds?: 0 | 30 | 60       // only WRITTEN/SPOKEN; client-side countdown, skippable
    }
  ]
}
```

- Item ids are immutable once an attempt exists (existing "duplicate to edit" rule applies to v3).
- Student read model adds `kind: "V3"` (read-side only). No answer key in `content`.
- `PRONUNCIATION` skill: every item must be `stimulus.type = "AUDIO"` (model) + `response.type = "SPOKEN"`.
- v2 is read as one item with `id = "main"` (`prompt`, `stimulus`, `response` from the v2 root). v1 legacy keeps its own path.

## 2. Keys and feedback (private)

`private.practice_item_keys(practice_activity_id uuid, item_id text, answer_key jsonb null, feedback jsonb, primary key (practice_activity_id, item_id))`

- `answer_key`: the v2 shapes (`{optionId}`, `{optionIds}`, `{value}`, `{blanks:[…]}`, `{order}`); null for WRITTEN/SPOKEN.
- `feedback`: `{ correct?: string(..600), incorrect?: string(..600), options?: { [optionId]: string(..600) } }` — `options` only for CHOICE_SINGLE/CHOICE_MULTI.
- Never readable by `authenticated`/`anon`. Same attempts guard as `private.practice_answer_keys`.

## 3. Responses per item

`public.practice_item_responses(id uuid pk, practice_attempt_id uuid fk, item_id text, round smallint check (1,2), response jsonb, confidence text null check (LOW,HIGH), evaluation_status text check (CORRECT, INCORRECT, PENDING_MANUAL, SKIPPED), feedback text null, option_feedback text null, correct_answer jsonb null, created_at timestamptz, unique (practice_attempt_id, item_id, round))`

RLS: select only, through the same visibility as the attempt (owner Student, staff that can view the student). Writes only through RPCs.

## 4. RPCs (security definer, `search_path=''`, `auth.uid()`-derived, granted to `authenticated` only)

| Function | Returns | Rules |
|---|---|---|
| `submit_practice_item(p_attempt uuid, p_item_id text, p_round smallint, p_response jsonb, p_confidence text default null)` | jsonb `{itemId, round, evaluationStatus, feedback, optionFeedback, correctAnswer, canRetry}` | Own IN_PROGRESS attempt; item belongs to the attempt (all items, or `item_ids` for REVIEW). Same (attempt, item, round) again returns the stored row (idempotent). Round 2 only after round-1 INCORRECT on an objective item. `p_response = {"skip": true}` in round 2 stores SKIPPED. `correctAnswer` is null in round 1; set in round 2 / skip (decision B). Objective items graded with the v2 rules; WRITTEN `{text}` and SPOKEN `{mediaId}` → PENDING_MANUAL. Touches `practice_attempts.last_activity_at`. Subscription gate error unchanged (42501 'active subscription required'). |
| `finalize_practice_attempt(p_attempt uuid)` | jsonb `{score, maxScore, evaluationStatus, metrics}` | Every item of the attempt has a round-1 response. Sets attempt SUBMITTED, writes `practice_results` (`score` = objective items correct in round 1, `max_score` = objective items, `evaluation_status` = PENDING_MANUAL if any manual item else CORRECT when score = max_score else INCORRECT, new column `metrics jsonb` = `{itemCount, firstTryCorrect, recovered, missed, skipped, highConfidenceErrors, pendingManual}`). Updates schedules (§5). Idempotent for an already SUBMITTED attempt (returns the stored result). Never writes `lesson_progress`, `assessment_attempts`, `skill_scores`. |
| `start_practice_review(p_practice_activity_id uuid, p_idempotency_key uuid)` | `practice_attempts` row | Same access/gating/subscription checks as `start_practice_attempt`; `attempt_kind = 'REVIEW'`, `item_ids` = the caller's due items for that activity (§5), ordered high-confidence errors first then oldest due. Resume rule C per kind. Raises SQLSTATE `YP002`, hint `PRACTICE_NOTHING_DUE` when nothing is due. |
| `student_due_reviews()` | table `(practice_activity_id uuid, due_count int, high_confidence_errors int, oldest_due_at timestamptz)` | Only reachable, visible activities with `due_count > 0`. |
| `reserve_practice_audio(p_attempt uuid, p_mime text, p_item_id text)` | as existing | Overload; media row gets `item_id`. |
| `teacher_practice_save_v3(p_id uuid, p_payload jsonb, p_item_keys jsonb)` | as `teacher_practice_save` | Same authorization/scope/AAL2 as the existing save; `p_payload.content` is v3 and passes `private.validate_practice_v3`; `p_item_keys = { [itemId]: { answerKey, feedback } }` must cover every objective item. |
| `finalize_practice_review(…, p_item_id text)` | as existing | Overload; review row gets `item_id` (one review per manual item). |

`start_practice_attempt` keeps its signature; for v3 it is the FULL start. `submit_practice_attempt` keeps v1/v2.

## 5. Spaced review schedule

`public.practice_item_schedules(user_id uuid, practice_activity_id uuid, item_id text, box smallint check (1..5), due_at timestamptz null, last_result text, high_confidence_error boolean, last_attempt_id uuid, updated_at timestamptz, primary key (user_id, practice_activity_id, item_id))` — select own rows only; written only by `finalize_practice_attempt`.

Per objective item, at finalize (FULL or REVIEW attempt):
- round-1 CORRECT: `box = existing ? box + 1 : 2`; if `existing.box = 5` → graduated (`due_at = null`, box stays 5); else `due_at = day_start + interval[box]`.
- round-1 INCORRECT (even if recovered in round 2): `box = 1`, `due_at = day_start + 1 day`, `high_confidence_error = (confidence = 'HIGH')`.
- `interval = {1: 1d, 2: 3d, 3: 7d, 4: 14d, 5: 30d}`; `day_start = date_trunc('day', now() at time zone 'America/Recife') at time zone 'America/Recife'`.
- Due = `due_at is not null and due_at <= now()`. WRITTEN/SPOKEN items are never scheduled (decision D).

The app mirrors this in `src/modules/practice/domain/spaced-review.ts` (pure, unit-tested with the same table of cases).

## 6. App surfaces

- Player: one item at a time, optional confidence toggle (when `askConfidence`), feedback in an `aria-live` region with focus moved to it, "Tentar de novo" for a missed objective item in a reinforcement round after the last item (not immediately), summary at the end ("6 de 8 na 1ª tentativa · 2 recuperadas"). Pre-task screen: objective, rubric criteria for WRITTEN/SPOKEN items (`rubric.ts`), optional planning countdown. Resume from stored item responses.
- Result: per-item breakdown; no immediate "Praticar de novo" for v3 (reinforcement round + spaced review replace it).
- Recommendation order: resume open attempt → due assignment → due review (high-confidence errors first, then oldest) → existing ranks; reachable only; each with a readable reason.
- /pratica: hero "Revisão de hoje: N perguntas" when reviews are due; history with real states (Em andamento → Continuar, Abandonada, Aguardando revisão, Revisada, "X/Y na 1ª tentativa"); summary splits effort (≈ min estimados, práticas enviadas) from performance (acertos na 1ª tentativa nos últimos 7 dias, perguntas para revisar).
- Teacher builder: item list (add, remove, reorder, type per item, max 20), objective field, per-item feedback and per-option explanations, pronunciation template (AUDIO model + SPOKEN), planning seconds for WRITTEN/SPOKEN; preview runs the same player; per-item manual review.

## 7. Seed

`supabase/seed.sql` gains two v3 examples linked to lesson 1 (reachable for a new Student): a grammar/vocabulary practice with 6–8 mixed objective items with per-option explanations, and a pronunciation practice with an AUDIO model asset (placeholder asset row if no file) + SPOKEN response.
