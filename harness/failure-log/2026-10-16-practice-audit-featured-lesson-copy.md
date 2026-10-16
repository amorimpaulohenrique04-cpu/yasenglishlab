# Failure - "Pratique o que você estudou" features a lesson not yet studied

Classification: ui contract  
Status: resolved  
Repeatable: yes  
Date: 2026-10-16  
PR/commit related: branch feat/practice-10-phase-0 (practice-10-phase-0)  

## Symptom

On `/pratica`, under the heading "Pratique o que você estudou" / "Cada aula tem atividades curtas com o conteúdo que você viu nela.", the featured block reads "Ainda não estudada · Módulo 1 · Aula 02". The page also shows two competing primary CTAs that start different activities: hero "Começar prática" (Present simple em contexto) and featured "Começar a praticar" (first activity of the group: Canonical Speaking Review).

## Evidence

- Live page as `student.dev@example.test` (2026-10-16): `/aulas` shows 0/3 lessons done, current lesson "Welcome to Yas" (Aula 01). The library teaser says "5 atividades em 1 aula": every practice is linked to Aula 02.
- `src/app/(protected)/(student)/pratica/_practice/grouping.ts:115-120` sorts groups current -> done -> upcoming -> free; `page.tsx` always features `groups[0]`. When the current lesson has no practice and nothing is done, an `upcoming` lesson becomes the featured block.
- The heading/description copy in `page.tsx` is fixed and does not depend on the featured group's state.
- The hero recommendation (`recommendPractice`, `src/modules/practice/domain/models.ts:227`) is ranked independently of that group (deadline -> deterministic -> recently accessed lesson -> fewer attempts), so the two CTAs point to different activities. Its explanation here is generic: "É uma atividade curta com feedback objetivo disponível agora."

## Root cause

The featured-group copy assumes the first group is current or studied, but the ordering allows an upcoming lesson to be first. The hero and the featured block use two independent selection rules with no shared "next step".

## Responsible layer

UI (practice page composition and copy); recommendation ranking is domain logic in the practice module.

## Immediate fix

Lessons not reached are gated in the database (`practice_lesson_reached`, `student_practice_reach`) and rendered as `locked` in `src/app/(protected)/(student)/pratica/_practice/grouping.ts`; the featured block is the first non-locked group; heading/description follow the featured state (`FEATURED_HEADING` in `page.tsx`); the featured CTA is secondary ("Praticar esta aula") so the hero is the single primary action; recommendation only ranks reachable activities.

## Permanent protection

Database refusal (SQLSTATE YP001) for unreached lessons, mapped to `PracticeLessonNotReachedError`; UI reads reach from the database instead of re-deriving it.

## Test/eval created

`tests/unit/practice-grouping.test.ts` (unreached lesson is locked and never featured, ordering, reachable next activity), `tests/unit/practice.test.ts` (gate error detection), `supabase/tests/practice_lifecycle.sql` (reach matrix).

## Reproduction

1. Use a student with no completed lessons whose current lesson has no linked practice (the local `student.dev@example.test` matches).
2. Open `/pratica`: the featured block shows "Ainda não estudada" under "Pratique o que você estudou".

## Before/after proof

Before: 2026-10-16 live page text "Ainda não estudada · Módulo 1 · Aula 02" under "Pratique o que você estudou".  
After: 2026-10-16 /pratica on the dev stack shows lesson 2 as "Disponível quando você chegar a esta aula" without start buttons and features the reachable "Prática livre" under "Pratique o conteúdo do curso".
