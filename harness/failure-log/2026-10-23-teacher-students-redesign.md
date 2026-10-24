# teacher-students-redesign — progresso calculado sobre amostra

Primary classification: architecture

## Historical reproduction

O perfil anterior (`src/server/teacher-operations/student-projection.ts`) carregava até 50 registros de lesson_progress e fazia a média apenas dos existentes. Uma trilha de duas aulas, com um único registro a 50%, aparecia como média de 50% em vez de 25%. O arquivo legado é preservado, mas o novo perfil não o usa.

## Structural correction and permanent guard

A projeção de Alunos calcula o denominador a partir das aulas publicadas pertencentes à trilha canônica e inclui zero para aulas sem registros. Sem aulas, retorna null. A lista não depende do limite de 200 alunos e as consultas são paginadas.

`supabase/tests/teacher_students_workspace.sql` reproduz a fórmula anterior (50%), comprova o resultado corrigido (25%), verifica uma trilha CUSTOM e uma carteira com 205 alunos distintos. O runner local transacional fica em harness/evidence/teacher-students-redesign/local-db.mjs. A fixture e suas alterações são revertidas; a migration permanece apenas no banco local para avaliação visual.

## Verification status

Smoke SQL e cinco testes de domínio passaram; checks estáticos e evidência visual registrados no README da tarefa. Gates amplos adiados explicitamente pelo usuário. Não equivale a certificação completa.
