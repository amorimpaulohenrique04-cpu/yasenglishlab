# Practice v3 — current contract

This document describes the current v3 contract for teacher-authored practices attached to a lesson. The approved lesson-bound flow in [ADR 0025](./adr/0025-lesson-bound-practice-final-submission.md) supersedes the earlier independent cohort assignment, lesson-gate bypass, immediate correction, reinforcement rounds, spaced review, and six-step authoring decisions. Historical attempts, responses, results, and schedule rows remain stored and readable under their existing authorization; they do not drive new lesson-bound attempts or reviews.

## 1. Authoring and access

Teacher + AAL2 and teacher course scope remain required. A new draft requires a title, course, module, and lesson; question completeness is required at publication. The three authoring stages are information, questions, and review/publication. `teacher_practice_autosave(p_id, p_payload, p_item_keys, p_creation_key, p_expected)` persists drafts with an idempotent creation key and expected revision. A stale revision returns a conflict instead of overwriting newer work. `teacher_practice_save_v3` remains the authorized content/key persistence command used by the autosave contract.

Every published teacher practice has a valid lesson link. Students who are authorized to access that lesson can see its published practices under the same lesson, enrollment, path, and paid-access rules. Cohort assignments do not grant access or bypass lesson availability. Unpublished practices and answer keys remain private.

## 2. Content v3 (`practice_activities.content`)

The domain schema is `practiceContentV3Schema` in `src/modules/practice/domain/content-v3.ts`; the SQL validator is `private.validate_practice_v3`. The payload has `version: 3`, `objective` (1–200 characters), `askConfidence` (boolean), optional `instructions` (up to 600 characters), `evaluationMode` (derived as `MANUAL_PENDING` when any item is WRITTEN/SPOKEN, otherwise `DETERMINISTIC`), and 1–20 unique items.

Each item has an id matching `^[a-z0-9-]{1,40}$`, a plain-text `prompt` (1–600 characters), `stimulus` (`NONE`, `TEXT`, `IMAGE`, `AUDIO`, or `VIDEO`), and `response` (`CHOICE_SINGLE`, `CHOICE_MULTI`, `TRUE_FALSE`, `CLOZE`, `ORDERING`, `WRITTEN`, or `SPOKEN`). Optional fields are top-level item fields:

| Field | Contract |
| --- | --- |
| `weight` | Integer 1–100 for objective items only; omitted means 1. Manual items cannot have a weight. |
| `difficulty` | String up to 40 characters. |
| `estimatedSeconds` | Integer 1–14,400. |
| `shuffleOptions` | Boolean; omitted means false. |
| `showExplanation` | Boolean; omitted means true. |
| `promptDocument` | Optional bounded structured text, described below. |
| `planningSeconds` | `0`, `30`, or `60`; applies only to WRITTEN/SPOKEN and can be skipped. |

`promptDocument` is an array of 1–50 strict blocks. Each block is `paragraph`, `bullet`, or `numbered`, with 1–100 children. Each child has `text` (up to 600 characters) and optional boolean `bold`, `italic`, and `underline` marks. Unknown fields and raw HTML are rejected. `prompt` remains the accessible plain-text fallback. The renderer creates React text and mark nodes; it never interprets content as HTML.

`PRONUNCIATION` items require an AUDIO stimulus and SPOKEN response. Existing v1/v2 content remains readable; a v2 practice is projected as one item with id `main`. Student read models may add `kind: "V3"`; this is not stored in the database. Answer keys and feedback stay in `private.practice_item_keys` and never appear in the practice content payload.

## 3. Draft answers and final submission

The learner's editable provisional responses and option order are stored in private `practice_answer_drafts`. The authenticated Student RPCs are:

| RPC | Contract |
| --- | --- |
| `practice_answers_get(p_attempt)` | Read the learner's own provisional answers. Returns no grading data. |
| `practice_answers_save(p_attempt, p_answers)` | Save or replace the learner's own editable answers. Does not grade. |
| `practice_submit_final(p_attempt)` | Validate that every item has an answer, grade and finalize the attempt transactionally, then return the stored result. Repeated submission returns the same result. |

`start_practice_attempt(p_practice_activity_id, p_idempotency_key)` remains the start command. A learner has one final submitted attempt per activity. An unfinished attempt can be resumed; leaving it unfinished does not consume the final submission. Lesson practices do not use `submit_practice_item`, `finalize_practice_attempt`, or `start_practice_review` for their current flow. Those compatibility RPCs reject the old round/review behavior, and `student_due_reviews()` reports no new v3 due reviews.

The database derives the learner from `auth.uid()`. Provisional endpoints return no verdict, feedback, correct answer, or score. The final command grades all responses in one transaction; keys and configured explanations are available only after final submission. Teacher preview runs the same response semantics in memory and creates no attempt or result.

## 4. Results and boundaries

`score` and `maxScore` are weighted objective points, using each item's `weight` or 1. Manual WRITTEN/SPOKEN items remain `PENDING_MANUAL` and contribute no automatic points. `metrics.firstTryCorrect` is an item count, not a weighted score. Practice results do not write `lesson_progress`, `assessment_attempts`, or `skill_scores`; they do not establish or change CEFR proficiency.

## 5. Manual review and feedback progress

Each WRITTEN/SPOKEN answer is reviewed on its own by an assigned Teacher (`finalize_practice_review` with `p_item_id`); the result becomes `MANUAL_REVIEWED` only when the last open answer of the attempt is reviewed, with one `PRACTICE_FEEDBACK_READY` notification and the objective score untouched. Read models (migration `20261025140000_practice_review_feedback_consistency.sql`):

- **Teacher queue** — `get_teacher_review_queue_page(p_filters)` returns one entry per attempt with all of its pending answers. Tab, search and cohort filters run before the page is cut; pages are keyset cursors over `(submitted_at, attempt id)` (20 by default, at most 50), so an attempt with up to 20 open answers is never split. `kinds` is the union of the pending answers' kinds: a written + spoken attempt appears in both tabs and once in "all", so tab counts may sum above the total. Totals and counts cover the Teacher's whole scope. `get_teacher_review_queue_position(p_attempt)` gives "n de m" and neighbours.
- **Teacher detail** — `get_teacher_reviews(p_attempt)` lists the manual answers; `get_teacher_review_context(p_attempt).questions` lists every question in its original order (prompt, public response definition, the Student's round-1 answer, persisted evaluation, review flag), never `private.practice_item_keys`. Only WRITTEN/SPOKEN questions take a rubric. After a save the server re-reads the attempt: while an answer is pending the Teacher stays on it ("próxima pergunta"); only a finished attempt moves to the next one.
- **Student Feedbacks** — `list_student_feedbacks` returns one PRACTICE row per attempt: `PENDING` (0 of M reviewed), `PARTIAL` (1..M-1) or `REVIEWED` (`MANUAL_REVIEWED`), with `manual_total/manual_reviewed/manual_pending`. v1/v2 count as one answer. v3 comments are read per question on `/pratica/<attempt>`, never flattened into the feed.

## Historical decisions

The earlier v3 phases specified round-one immediate verdicts, a second reinforcement round, per-item spaced-review schedules, 24-hour resume/abandonment, and a bypass for activities assigned to a student's cohort. Those decisions are superseded for lesson-bound practices by ADR 0025. Existing response/result history and schedule rows are retained; current lesson-bound creation and submission use the contracts above.
