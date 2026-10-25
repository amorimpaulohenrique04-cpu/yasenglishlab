# GOAL — practice-review-consistency: Prática do aluno ↔ Revisão do professor

Status: in_progress  
Owner: agent  
Created: 2026-10-25  
Updated: 2026-10-25

## Objective

Uma prática v3 (até 20 perguntas) gera uma entrada na fila do professor, o professor vê a prática inteira e revisa
todas e somente as respostas WRITTEN/SPOKEN, uma por vez e sem pular pendências da mesma tentativa; o aluno vê
PENDING → PARTIAL (n/M) → REVIEWED com uma linha por prática no feed; a fila é paginada por tentativa no banco.

Plano de origem: `PLANO_CORRECAO_PRATICA_REVISAO_PROFESSOR.md` (R01–R05, blocos A–F). Base auditada
`251ec1c` = `origin/main` no início (sem desvio).

## Relevant context

- `docs/PRACTICE_V3.md`, ADR 0010 (rubrica categórica), ADR 0025 (submissão final única).
- `supabase/migrations/20261017180000_pr1_student_feedbacks.sql` (R01),
  `20261016130000_stage_13b_practice_v3.sql` (`get_teacher_reviews`, `finalize_practice_review`),
  `20261022180000_teacher_review_insights.sql` (`get_teacher_review_context`).

## Acceptance criteria

- [x] `list_student_feedbacks`: 1 linha PRACTICE por tentativa; PENDING (0/M), PARTIAL (n/M), REVIEWED (M/M);
      `manual_total/manual_reviewed/manual_pending` aditivos; `total` conta entidades.
- [x] "Finalizar e ir para a próxima" vai à próxima pergunta pendente da mesma tentativa (revalidado no servidor).
- [x] Detalhe do professor mostra todas as perguntas em ordem real, sem gabarito privado; só abertas editáveis.
- [x] Filtros por tipo usam a união dos itens pendentes (`kinds`).
- [x] Fila paginada por tentativa em SQL; contadores no escopo completo; 101+ tentativas e tentativa de 20 itens.
- [x] `finalize_practice_review`, `practice_submit_final`, v1/v2 e testes existentes preservados.

## Allowed files / domains

- Nova migração `supabase/migrations/*_practice_review_feedback_consistency.sql`.
- `src/server/feedbacks/`, `src/app/(protected)/(student)/feedbacks/`, `src/server/teacher-operations/pedagogy.ts`,
  `src/app/(protected)/(teacher)/teacher/revisoes/`, `src/modules/teacher-operations/{domain,ui}/review-*`,
  `src/modules/practice/ui/practice-final-player.tsx` (só exibição de progresso da revisão).
- Testes: `supabase/tests/*`, `tests/unit/review-queue.test.ts`, `tests/e2e/*`; `docs/PRACTICE_V3.md`.

## Forbidden areas

- Migrações já aplicadas; motor de proficiência/placement; nota objetiva; billing; notificações/cron; redesign geral.

## Mandatory tests

- `npm run verify:agent`, `npm run verify:db`, `npm run verify:security`, `npm run verify:ui` (UI alterada).
- `supabase/tests/student_feedbacks.sql`, `practice_items.sql`, novo `practice_review_consistency.sql`.
- `tests/unit/review-queue.test.ts`.

## Definition of done

Conforme `harness/GOAL.template.md` e checklist da seção 8 do plano de origem.

## Evidence (local, 2026-10-25, uncommitted tree on `251ec1c`)

- PASS: format:check, lint, typecheck, test:unit (471), test:integration, verify:agent, verify:db (static),
  test:integration:db (52 SQL + 6 concurrency), test:rls (42 SQL) — includes new `practice_review_consistency.sql`
  (104 attempts / 126 open answers, 20-item attempt, both orders, filters before pagination, unassigned Teacher).
- PASS: E2E `tests/e2e/practice-manual-review-v3.spec.ts` (canonical fixture, dev server, 0 skipped).
- NOT VERIFIED locally: `tests/e2e/teacher-pedagogy.spec.ts` timed out at 5s navigations (login, then practice
  start) on a cold dev server; untouched flows. Needs the CI production-build run.
- NOT RUN: verify:full (resets the local DB), verify:ui; CI Gate pending (no PR yet).
