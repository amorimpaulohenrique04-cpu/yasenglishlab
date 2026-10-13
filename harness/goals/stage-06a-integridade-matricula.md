# Etapa 06a — integridade de matrícula

Base: ADR 0015 (decisões 3 e 4). Migration aditiva `20261013160000_stage_06a_enrollment_integrity.sql`.

## Objetivo

- Transferência de coorte entre cursos encerra a enrollment do curso anterior na mesma transação.
- Aluno sem coorte ativa não grava progresso de aulas.

## Decisões

- Estado de encerramento: `CANCELLED` (o CHECK só permite ACTIVE/COMPLETED/CANCELLED; `COMPLETED` afirmaria conclusão e exige `completed_at`).
- Transferência no mesmo curso não encerra a enrollment; retry com o mesmo `operation_id` retorna antes de qualquer escrita.
- Reabertura de enrollment não-ACTIVE (`confirm_placement_choice`, transferência de volta) passa por `private.activate_enrollment` e grava `audit_logs` (`enrollment_reactivated`, sem PII).
- Gate: trigger `access_01_cohort_membership_gate` em `lesson_progress` (só o próprio aluno; staff e jobs isentos), erro `42501` / `active cohort membership required`.
- Sem backfill de produção: escolher coorte seria inferir dados. Alunos legados ficam bloqueados explicitamente até um Admin alocá-los.
- Nada de progresso, memberships ou histórico é apagado.

## Fixtures ajustadas

- `supabase/seed.sql` não cria alunos/enrollments. Único canônico órfão: `canonical.student` (setup E2E) ganhou a coorte dedicada `canonical-ana` em `scripts/setup-canonical-e2e.mjs`.
- Testes SQL com aluno gravando progresso receberam membership: `subscription_access`, `admin_content`, `vertical_slice_persistence`.

## Verificação

- `supabase/tests/enrollment_integrity.sql` (suite `integration` e `enrollment-integrity`).
- Pendente em CI (Database job): `pnpm test:integration:db`, E2E canônico (`canonical-slice`, `recorded-video`).
- Pendente TypeScript: mapear `42501` com mensagem `active cohort membership required` em `src/server/learning/**` para um erro de domínio (hoje cairia como erro genérico/autorização).
