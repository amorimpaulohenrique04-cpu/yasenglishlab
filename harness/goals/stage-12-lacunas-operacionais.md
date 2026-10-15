# GOAL — stage-12-lacunas-operacionais: lacunas operacionais do SaaS

Status: in_progress
Owner: agent
Created: 2026-10-15
Updated: 2026-10-15

## Objective

Fechar, numa unica PR empilhada sobre a Etapa 11, as lacunas que impedem operar o produto: o professor cria, publica e atribui por turma praticas dinamicas (estimulo texto/imagem/audio/video combinado com resposta marcar, completar, ordenar, escrever ou falar); o Admin cria e publica o teste de entrada (avaliacao de entrada explicita), monta a trilha de cada turma (varias turmas por item, ordem, liberacao por data e progressao sequencial), edita direitos de plano, matricula aluno no proximo curso e ve alertas operacionais; o aluno so le o que e dele (fecha a leitura aberta de titulos de outros cursos).

## Visible result

- Professor abre `/teacher/praticas`, monta uma pratica de qualquer formato, pre-visualiza como aluno, publica e atribui a uma de suas turmas com prazo; aluno da turma ve em "Atribuidas a voce" e responde; aluno de outra turma e professor de outra turma nao acessam.
- Admin abre `/admin/assessments`, publica o teste de entrada e um aluno novo o executa no onboarding.
- Admin abre `/admin/cohorts/[id]/trilha` e define ordem, datas e sequencia; o aluno ve aulas bloqueadas com motivo.
- Admin agenda mudanca de direito de plano, matricula aluno concluido no proximo curso e ve os alertas na visao geral.

## Relevant context

- `docs/TESTING.md`, `docs/DEFINITION_OF_DONE.md`, `docs/SECURITY.md`.
- Decisoes do usuario em 2026-10-15: `harness/agent-state/decisions.md`.
- Plano aprovado: `harness/agent-state/plan.md` (resumo) e o plano de sessao da Etapa 12.
- `docs/ADMIN_CONTENT.md`, `docs/PRACTICE_ENGINE.md`, `docs/PLACEMENT.md`, `docs/BILLING.md`, `docs/AUTH_RBAC_RLS.md`, `docs/UI_CONTRACT.md`; ADRs 0006, 0009, 0010, 0017, 0018.
- Migrations base: `20261001155659_admin_content_v1.sql`, `20261001190000_assessment_engine_v1.sql`, `20261002144554_p21_teacher_pedagogy_v1.sql`, `20261003183921_stage_01_enrollment_core.sql`, `20261013160000_stage_06a_enrollment_integrity.sql`, `20261014120000_stage_11_access_closure.sql`.

## Acceptance criteria

- [ ] Professor so cria/edita/publica/atribui no proprio escopo (curso das suas turmas ativas, turmas dele); AAL2 obrigatorio; pratica com tentativas e imutavel (duplicar).
- [ ] Pratica `ASSIGNED` so e visivel a aluno com membership ativa em turma atribuida; rascunho nunca e visivel ao aluno; gabarito nunca vaza.
- [ ] Cada tipo de resposta (escolha unica, varias, verdadeiro/falso, lacunas, ordenar) corrige no banco; escrever e falar vao para a fila de revisao existente, sem nota agregada nem CEFR.
- [ ] `start_placement_assessment` usa somente a avaliacao marcada `is_placement`; publicar valida o contrato; so Admin+AAL2.
- [ ] Trilha da turma: turma padrao x propria, itens exclusivos, liberacao por data, sequencia, conclusao automatica pela trilha do aluno; leitura de titulos de outros cursos fechada.
- [ ] `admin_plan_set_entitlement` preserva historico de reservas e so aceita vigencia futura; sem edicao de preco.
- [ ] `admin_enroll_in_course` idempotente, auditado, sem encerrar a matricula concluida.
- [ ] `admin_operational_alerts` em uma chamada, dentro do orcamento do E2E da visao geral.
- [ ] Toda funcao nova revogada de public/anon/authenticated e liberada explicitamente; AAL2/RLS nunca afrouxados.
- [ ] ADRs 0020-0023, docs de dominio e OPEN_QUESTIONS atualizados.
- [ ] No unrelated behavior regressed.

## Allowed files / domains

- `supabase/migrations/20261015*` (novas), `supabase/tests/*`, `scripts/run-sql-tests.mjs`, `scripts/setup-canonical-e2e.mjs`, `scripts/assert-canonical-e2e.mjs`.
- `src/modules/{practice,teacher-operations,admin-content,admin-assessments,admin-plans,cohorts,learning,progress,home,placement,billing}/**`, `src/server/**`, `src/components/ui/**` (somente extensoes necessarias), `src/app/(protected)/**`.
- `tests/unit/**`, `tests/integration/**`, `tests/e2e/**`, `tests/a11y/**`.
- `docs/**`, `harness/**`.

## Forbidden areas

- Migrations ja aplicadas (somente migrations aditivas novas).
- Webhook Asaas, checkout, preco de plano: fora do escopo.
- Host de deploy, plataforma de aula ao vivo, canal de suporte, LGPD, recuperacao de MFA, troca de plano, remarcacao: continuam em OPEN_QUESTIONS.
- Redesign visual (prototipos em `artifacts/`): nao entra; telas novas usam os primitivos atuais.
- Goldens/baselines visuais: nao promover sem evidencia de tela aprovada alterada.

## Mandatory tests

- `npm run verify:agent`
- `npm run verify:db` e `npm run test:integration:db` / `npm run test:rls` (suites novas registradas).
- `npm run verify:security`
- `CANONICAL_E2E=1 npm run verify:ui` (a11y e screenshots das telas novas).
- `npm run verify:full` antes de marcar `done`.

## Required evidence

- Resultado exato dos comandos acima em `harness/evidence/stage-12-lacunas-operacionais/README.md`.
- Screenshots desktop/tablet/mobile das telas novas.
- Evidencia de RLS/AAL2 (matriz de negativos) para cada migration.

## Definition of done

Done means every acceptance criterion passes, mandatory checks pass, evidence was inspected, decisions/progress were recorded, blockers/TODOs were registered, and `harness/feature_list.json` reflects the real state. A written claim without matching system state is not done.

## Sessao C1 — 2026-10-15

Escopo desta sessao: `supabase/migrations/20261015120000_stage_12c1_cohort_path_model.sql`,
`supabase/tests/cohort_path.sql`, `scripts/run-sql-tests.mjs` e estado/evidencia em `harness/`.
Aceite local: modelo DEFAULT/CUSTOM, audience, referencias coerentes, titulos por matricula/trilha,
assets/progresso por data e sequencia, conclusao pela trilha, regressao de ASSIGNED/placement/staff.
Somente stack isolada 55422, testes transacionais, sem commit, sem build, sem subagentes.
C2/RPCs, integracao visual e gates finais pertencem as proximas sessoes do handoff.

## Sessao C2 — 2026-10-15

Escopo: migration nova `supabase/migrations/20261015130000_stage_12c2_cohort_path_admin.sql`,
`supabase/tests/cohort_path_admin.sql`, `scripts/run-sql-tests.mjs`, `docs/COHORT_PATH.md` e harness.
Aceite: RPCs Admin get/save (ADMIN+AAL2, lock da turma, substituicao atomica, copia do curso, audit),
RPC do aluno com ordem, AVAILABLE/LOCKED_DATE/LOCKED_SEQUENCE e data efetiva; conclusao apos save.
Testes SQL transacionais na stack 55422, regressao C1, typecheck/lint/format; gates finais adiados pelo handoff.
Sem commit/build, sem alterar migrations anteriores ou codigo de UI.

C2: `docs/README.md` incluido no escopo para descoberta do contrato `COHORT_PATH.md` no mapa de documentacao.

## Sessao E SQL — 2026-10-15

Escopo: `supabase/migrations/20261015140000_stage_12e_admin_enroll_next_course.sql`,
`supabase/tests/admin_course_enrollment.sql`, `scripts/run-sql-tests.mjs`, `docs/PLACEMENT.md` e harness.
Aceite: ADMIN+AAL2, validacao de aluno/curso/turma/vaga, idempotencia concorrente, conflito de parametros,
uso de activate_enrollment, preservacao de COMPLETED, audit e rollback em falha. Teste novo transacional,
regressao de placement/trilhas/autorizacao, typecheck/lint/format. Gates finais seguem o handoff.
Sem commit/build, banco somente 55422, sem alteracoes no app ou em migrations anteriores.

## Fechamento A e B — 2026-10-15

Escopo e aceite: ver secao Fechamento A e B do plan.md. Pedido expresso para concluir autoria de praticas
(A) e teste de entrada (B), incluindo app, testes e prova visual. UI C/E fica fora. Metas locais: E2E/a11y
reais na stack isolada, unit/integration/typecheck/lint e verificadores sem build. Estado macro so muda apos
os gates finais; nenhuma permissao para commit/push ou uso do banco de desenvolvimento.

## D/F — pedido expresso do usuário (2026-10-15)

D e F deixam de estar adiados nesta sessão. Implementar admin_plan_list/set_entitlement e editor em /admin/billing?tab=plans, apenas direitos com vigência futura e histórico de reservas intacto; admin_operational_alerts read-only ADMIN+AAL2 em uma RPC e cartões na visão geral com causas do matching existente, revisão >3 dias, escolha >7 dias, entrada não publicada e concluído sem próxima matrícula. Escopo: migrations aditivas geradas pelo CLI, supabase/tests, registro SQL, src/modules/admin-plans/** e admin-overview, src/server/{admin-plans,admin-overview}/**, rotas Admin billing/overview e respectivas ações, testes unit/integration/SQL/E2E/a11y, docs BILLING/PLACEMENT/AUTH_RBAC_RLS/DATA_MODEL e harness. Não editar preço, webhook ou migrations anteriores; sem subagentes, next build ou banco dev. Commit/push/PR autorizados expressamente, sem merge. PR atual permanece rascunho enquanto C/E UI e gates macro estiverem pendentes.

Plano: 1 SQL D/F com negativos/atomicidade/histórico; 2 adaptadores e UI usando primitivos atuais; 3 testes focados, prova E2E/a11y/screenshots; 4 documentação/evidência, commits e atualização da PR.
