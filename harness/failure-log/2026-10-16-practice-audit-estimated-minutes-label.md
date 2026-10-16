# Failure - "min praticados" shows estimated minutes, not practiced time

Classification: observability  
Status: resolved  
Repeatable: yes  
Date: 2026-10-16  
PR/commit related: branch feat/practice-10-phase-0 (practice-10-phase-0)

## Symptom

"Resumo da semana" on `/pratica` shows "14 min praticados nos últimos 7 dias". The number is not measured practice time.

## Evidence

- `src/modules/practice/application/queries.ts:52-80`: `minutesThisWeek` sums `estimatedMinutes` of the activity of each SUBMITTED attempt in the last 7 days; attempt duration is not used.
- The same counters only see the last 30 attempts returned by `listHistory` (`src/server/practice/supabase-practice-repository.ts:165`), so a student with many recent open attempts can have completed work undercounted.
- `completedThisWeek` counts every SUBMITTED attempt, including PENDING_MANUAL ones still waiting for teacher review.

## Root cause

The summary derives effort from catalog estimates and a capped history query, while the label claims measured practice time.

## Responsible layer

Application (practice page query) and UI copy.

## Immediate fix

`getPracticeView` uses `listSubmittedActivityIdsSince(userId, weekStart)` (dated query, not the 30-row history) and exposes `estimatedMinutesThisWeek`; the summary reads "≈ N min estimados nos últimos 7 dias" and "atividades enviadas".

## Permanent protection

Dedicated repository port for the weekly window and a field name that states the value is an estimate.

## Test/eval created

`tests/integration/practice-application.test.ts` — "summarizes the last 7 days from a dated query, not from the capped history list".

## Reproduction

Submit one activity with `estimated_minutes = 5` taking any real duration; the summary adds exactly 5 min.

## Before/after proof

Before: 2026-10-16 live page shows "14 min praticados"; per the code above this is a sum of estimates (the per-attempt arithmetic was not checked against the database).  
After: 2026-10-16 integration test PASS; /pratica shows "≈ 0 min estimados nos últimos 7 dias".
