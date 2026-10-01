# P20 — Progresso V1 evidence

Status: in_progress / unverified  
Branch: `feat/p20-progress-v1`  
Baseline: `main@93666bf0478b9dabdc35c89dab72596026d7da9e`

## Discovery

- P19 Assessment Engine V1 is present in `main` via merge commit `93666bf0478b9dabdc35c89dab72596026d7da9e`.
- Progress can remain read-only; no database migration is currently justified.
- Learning already exposes canonical `lessonCompletion`, `moduleCompletion`, `courseCompletion`, `isLessonComplete` and `isModuleComplete`.
- Practice, Attendance and Assessment already expose RLS-readable source tables for the authenticated Student.
- P19 keeps `assessment_attempts.result_cefr` and `skill_scores.cefr_level` null while standard setting remains open.
- No `progress_dashboard`, summary table, persisted streak or goal source is required.
- Verification evidence is pending; no gate is marked PASS until observed.

## Verification

PENDING.
