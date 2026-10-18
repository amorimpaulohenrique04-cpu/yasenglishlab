# GOAL — placement-practice-dead-ends: fechar becos sem saída de placement e prática

Status: in_progress  
Owner: agent  
Created: 2026-10-18  
Updated: 2026-10-18

## Objective

Remover cinco becos sem saída confirmados na auditoria de 2026-10-18 nos fluxos de placement e
prática, sem alterar regras pedagógicas, CEFR, cobrança ou itens de `docs/OPEN_QUESTIONS.md`.

## Visible result

1. Aluno sem turma compatível em `/onboarding/placement` atualiza a disponibilidade ali mesmo e vê a
   lista recalculada (o RPC já aceita edição até STUDENT_DECISION).
2. Aluno matriculado manualmente pelo Admin (`admin_enroll_in_course`) sai do hero/diálogo de
   entrada e acessa as rotas pedagógicas; os alertas STALE_DECISION/PLACEMENT_NO_COHORT deixam de
   contá-lo. O caso de placement não é reescrito (PLACEMENT.md, Etapa 12E).
3. Admin+AAL2 troca o professor revisor de um caso REVIEW_PENDING com motivo auditado.
4. Admin vê alerta operacional para respostas WRITTEN/SPOKEN pendentes sem professor revisor.
5. A recomendação de prática não afirma "ainda não tentou" com base em histórico truncado.

## Relevant context

- `docs/PLACEMENT.md` (Etapa 12E: o comando administrativo não altera `placement_case`).
- `docs/TESTING.md`, `docs/DEFINITION_OF_DONE.md`, `docs/SECURITY.md`, `docs/AUTH_RBAC_RLS.md`.
- `supabase/migrations/20261003183921_stage_01_enrollment_core.sql`,
  `20261015140000_stage_12e_admin_enroll_next_course.sql`,
  `20261017120000_pr1_placement_teacher_assignment.sql`,
  `20261017130000_pr1_cohorts_unlimited.sql` (última versão de `admin_operational_alerts`),
  `20261016130000_stage_13b_practice_v3.sql`.

## Acceptance criteria

- [ ] Formulário de disponibilidade disponível no estado sem candidatos; salvar volta à lista.
- [ ] Regra de "entrada superada por matrícula ativa" com teste unitário; Home, gate pedagógico,
      destino comercial e onboarding a respeitam.
- [ ] `reassign_placement_teacher` (ADMIN+AAL2, REVIEW_PENDING, motivo, auditoria) com teste SQL.
- [ ] Alerta `PRACTICE_NO_REVIEWER` com teste SQL e contrato TS atualizado.
- [ ] Texto da recomendação sem a afirmação absoluta, com teste unitário.
- [ ] Migrações apenas aditivas; nenhuma migração aplicada editada.

## Allowed files / domains

- `src/app/(protected)/(student)/onboarding/**`, `src/app/(protected)/(student)/home/page.tsx`
- `src/app/(protected)/(admin)/admin/enrollments/**`
- `src/modules/placement/**`, `src/server/placement/**`
- `src/modules/admin-overview/**`, `src/modules/practice/domain/models.ts`
- `supabase/migrations/20261018150000_placement_practice_dead_ends.sql`, `supabase/tests/**`,
  `scripts/run-sql-tests.mjs`
- `tests/unit/**`, `tests/integration/**`, `docs/PLACEMENT.md`, `harness/**`

## Forbidden areas

- Billing, RLS de conteúdo, políticas de retake/CEFR, migrações já aplicadas.

## Mandatory tests

- `npm run verify:agent`, `npm run verify:db`, `npm run verify:ui` (telas do aluno alteradas).

## Definition of done

Todos os critérios passam, gates verdes, registros do harness atualizados, um PR para `main`.
