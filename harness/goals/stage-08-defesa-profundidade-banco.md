# Etapa 8 - defesa em profundidade no banco

Objetivo: reforcar no Postgres garantias que hoje dependem so de grants/RPCs, sem alterar migrations aplicadas.

Entrega (migration aditiva `20261014110000_stage_08_defense_in_depth.sql` + testes SQL):

- Imutabilidade por trigger: `practice_manual_reviews` (qualquer UPDATE/DELETE; a linha so existe finalizada) e `practice_results` (unico UPDATE permitido: `PENDING_MANUAL -> MANUAL_REVIEWED`; DELETE direto bloqueado). Erro `55000 historical record is immutable`. DELETE em cascata a partir de `practice_attempts` continua permitido (`pg_trigger_depth() > 1`).
- `private.validate_lesson_progress_identity()` e `private.audit_lesson_progress_change()` perdem EXECUTE de PUBLIC/anon/authenticated (funcoes de trigger criadas depois do revoke em massa).
- Testes (transacionais, rollback): `function_privileges.sql` (nenhuma funcao de public/private executavel por anon/PUBLIC; lista todas as ofensoras na excecao), `sensitive_tables_negative.sql` (anon e Student sem relacao nas 9 tabelas sensiveis), `record_immutability.sql`.
- Suites: `integration`, `rls`, `function-privileges`, `sensitive-tables-negative`, `record-immutability`.

Decisao: `teachers.user_id` NAO foi restringido por coluna - `src/server/students/students.ts` seleciona `teachers(user_id, ...)` em contexto de aluno; revisar antes de mudar o grant.

Verificacao real: job Database do CI (sem docker local).
