# ADR 0025 — Lesson-bound practices and final submission

## Status

accepted

## Date

2026-10-22

## Context

The Teacher practice flow in [ADR 0020](./0020-teacher-practice-authoring-and-cohort-assignment.md) used six-step authoring and independent cohort assignments, including an assignment bypass for lesson reach. The earlier v3 design added immediate item correction, reinforcement rounds, and spaced-review schedules. The approved redesign attaches practices to lessons and changes the learner flow to editable provisional answers followed by one final submission.

## Decision

1. **Lesson is the access boundary.** Every newly published teacher practice must link to a valid lesson in its course/module scope. A Student who is authorized to access that lesson may see its published practices under the lesson's existing enrollment, learning-path, and paid-access rules. Cohort assignment does not grant access or bypass lesson availability. Teacher authorship still requires TEACHER + AAL2 and the teacher's course scope.
2. **Authoring has three stages.** Information, questions, and review/publication replace the prior six-step editor. Draft autosave uses a stable creation key and expected revision so retries are idempotent and conflicts do not silently overwrite newer edits.
3. **Answers remain provisional until final submission.** Students can save and revise answers without receiving grading data. `practice_submit_final(p_attempt)` validates and grades the complete attempt transactionally; repeat requests return the stored result. Each Student has one submitted attempt per activity. An unfinished attempt can be resumed and does not consume that final submission.
4. **No new rounds or spaced reviews.** Lesson-bound practices do not use immediate item grading, a second reinforcement round, or new spaced-review schedules. Existing attempts, responses, results, and schedule rows remain stored for historical reads.
5. **Scoring stays within practice.** Objective items use integer `weight` from 1 to 100, default 1. Result `score` and `maxScore` represent weighted objective points; `metrics.firstTryCorrect` remains a question count. WRITTEN/SPOKEN stay pending human review with no automatic points. Practice does not change CEFR proficiency or write course-progress/assessment result records.
6. **Preview is non-persistent.** Teacher preview uses the learner response semantics without creating an attempt or result. Answer keys and configured explanations remain private until final submission.

## Alternatives

- Keep cohort assignment as an independent authorization path: rejected because it duplicates lesson access rules and can reveal work before the lesson is available.
- Show correction after every item and allow retries: rejected because the learner should submit a complete editable response before seeing evaluation.
- Delete or migrate historical review data: rejected; it is retained for historical reads and audit continuity.

## Consequences

- New Teacher practices are lesson-bound and visible to all Students authorized for their lesson; cohort membership alone does not expose them.
- The current learner RPCs are `practice_answers_get`, `practice_answers_save`, and `practice_submit_final`; `start_practice_attempt` remains the idempotent attempt-start command. The prior round/review RPCs are not used by this flow.
- The current v3 payload contract and optional item settings are defined in [PRACTICE_V3.md](../PRACTICE_V3.md). The approved UI reference is linked from [UI_CONTRACT.md](../UI_CONTRACT.md).
- [ADR 0020](./0020-teacher-practice-authoring-and-cohort-assignment.md) remains historical context for the original teacher-authoring rollout; its independent assignment and bypass decisions are superseded here.
