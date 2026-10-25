# GOAL — teacher-reviews-redesign: Revisões de prática do professor

Status: in_progress
Owner: agent/human
Created: 2026-10-22
Updated: 2026-10-22

## Objective

Redesenhar a fila (`/teacher/revisoes`) e a revisão (`/teacher/revisoes/[attemptId]`) de práticas a partir das duas referências do usuário, no mesmo padrão de Sessões (motion, container queries, selects personalizados).

## Visible result

- **Fila:** indicadores, abas por tipo e "Mais de 24h", busca, filtros por turma e ordem, linhas agrupadas por tentativa, prévia lateral com ↑/↓ e estado "Fila zerada!".
- **Revisão:** player de áudio próprio, escala visual de 4 níveis por critério, feedback com sugestões fixas, "Finalizar e ir para a próxima", navegação "n de m" e revisão enviada em modo leitura.

## Decisions (user, 2026-10-22)

- **Escopo:** visual + leitura extra, numa migration aditiva só de leitura (`20261022180000_teacher_review_insights.sql`).
- **Fora do escopo:**
  - transcrição, IA e notas numéricas (ADR 0010: níveis categóricos, sem nota agregada);
  - SLA de prática: a interface mostra só a idade da resposta, nunca "atrasada";
  - Entrada (placement).

## Acceptance criteria

- `TEACHER`+AAL2 e escopo do professor preservados; as novas RPCs retornam vazio/null fora do escopo.
- Cada ação exportada começa com `assertRole("TEACHER")`. O campo `next` só muda o redirect.
- `teacher-pedagogy` e2e: as asserções continuam; os seletores mudam (rádios; o áudio carrega ao abrir).
- Sem overflow horizontal em 390, 834 e 1440 px. Sem erros de console. `reduced-motion` respeitado.
- Gates: typecheck, lint, format, unit, SQL (`practice_authoring.sql`), `verify:db`, e2e `teacher-pedagogy`, a11y do professor e `p21-responsive`.

## Allowed files / domains

- `src/app/(protected)/(teacher)/teacher/revisoes/{page,layout,loading,error,actions}.tsx|ts`, `revisoes/[attemptId]/{page,loading}.tsx`
- `src/modules/teacher-operations/{domain/review-queue.ts,ui/review-*.tsx,ui/rubric-scale.tsx,ui/reviews.module.css}`
- `src/modules/practice/ui/audio-player.{tsx,module.css}` (novo; o `AudioPlayback` do aluno não muda)
- `src/server/teacher-operations/pedagogy.ts`
- `supabase/migrations/20261022180000_teacher_review_insights.sql`, `supabase/tests/practice_authoring.sql`
- `tests/unit/review-queue.test.ts`, `tests/e2e/teacher-pedagogy.spec.ts`

## Status

- **Inspeção no Claude in Chrome:** OK em 1440, 834 e 390 px (fila e revisão pendente).
- **Ainda não inspecionado:** o player com áudio real (não há áudio no seed local) e a revisão enviada; ambos ficam a cargo do e2e.
- **Gates:** registrados em `harness/agent-state/progress.md`. Nenhum gate obrigatório foi declarado verde sem execução.
