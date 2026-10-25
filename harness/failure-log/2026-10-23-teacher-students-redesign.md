# Failure — Teacher students redesign: progress calculated over a sample

Classification: architecture  
Status: open  
Repeatable: yes  
Date: 2026-10-23  
PR/commit related: local delivery (uncommitted)

## Symptom

Uma trilha de duas aulas, com um único registro a 50%, aparecia como média de 50% em vez de 25%.

## Evidence

`supabase/tests/teacher_students_workspace.sql` reproduz a fórmula anterior (50%) e comprova o resultado corrigido (25%). Runner local transacional: `harness/evidence/teacher-students-redesign/local-db.mjs`. Checks estáticos e evidência visual registrados no README da tarefa.

## Root cause

O perfil anterior (`src/server/teacher-operations/student-projection.ts`) carregava até 50 registros de `lesson_progress` e fazia a média apenas dos existentes, excluindo aulas sem registro do denominador.

## Responsible layer

Not recorded in the original entry. Affected code: `src/server/teacher-operations/student-projection.ts` (legacy file, preserved but no longer used by the new profile).

## Immediate fix

A projeção de Alunos calcula o denominador a partir das aulas publicadas pertencentes à trilha canônica e inclui zero para aulas sem registros. Sem aulas, retorna null. A lista não depende do limite de 200 alunos e as consultas são paginadas.

## Permanent protection

`supabase/tests/teacher_students_workspace.sql` verifica a trilha CUSTOM e uma carteira com 205 alunos distintos. A fixture e suas alterações são revertidas; a migration permanece apenas no banco local para avaliação visual.

## Test/eval created

- `supabase/tests/teacher_students_workspace.sql`: reproduz a fórmula anterior (50%), comprova o resultado corrigido (25%), verifica trilha CUSTOM e carteira com 205 alunos distintos.
- Five domain tests (names not recorded in the original entry).
- Local transactional runner: `harness/evidence/teacher-students-redesign/local-db.mjs`.

## Reproduction

Run `supabase/tests/teacher_students_workspace.sql`: it reproduces the previous formula (50%) before the correction. Local transactional runner: `harness/evidence/teacher-students-redesign/local-db.mjs`.

## Before/after proof

Before: trilha de duas aulas com um único registro a 50% resulta em média de 50% (fórmula anterior).  
After: 25% (resultado corrigido). Smoke SQL e cinco testes de domínio passaram; gates amplos adiados explicitamente pelo usuário; não equivale a certificação completa.
