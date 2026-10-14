# GOAL - stage-11-flow-gap-closure: fechamento das falhas e lacunas do fluxo

Status: in_progress
Owner: agent
Created: 2026-10-13
Updated: 2026-10-13

## Objective

Fechar, numa unica PR, as falhas da auditoria de 2026-10-13 (HEAD 9405647) no fluxo comercial -> acesso -> aprendizagem: acesso fail-closed para quem nao tem assinatura (com concessao explicita do Admin e backfill do legado), corte de acesso de ACTIVE com cancelamento agendado vencido, Pratica escopada por matricula, confirmacao de turma com CANCELLED pago, conclusao automatica de curso, agendador das notificacoes, `/support`, aviso de suspensao em `/progresso` e deteccao de matriculas sem turma ativa.

## Visible result

- Cadastro novo sem pagamento nao inicia Pratica, nao le conteudo e nao reserva encontro.
- Admin concede/revoga acesso de cortesia (AAL2 + auditoria) e ve matriculas sem turma ativa.
- Aluno que conclui todas as aulas publicadas ve "Curso concluido"; a matricula fica COMPLETED e a leitura continua.
- `/support` existe (so orientacao); `/progresso` mostra o aviso de suspensao e mantem os dados.
- Workflow agendado chama o endpoint de notificacoes e falha visivelmente sem segredo/URL.

## Relevant context

- Decisoes do usuario em 2026-10-13: ver `harness/agent-state/decisions.md`.
- `docs/adr/0015-subscription-lifecycle-and-access.md`, `docs/adr/0016-access-suspension-on-payment-failure.md`.
- Migrations: `20261013130000_stage_04_subscription_access_gate.sql`, `20261013160000_stage_06a_enrollment_integrity.sql`, `20261013170000_stage_04d_subscription_cancellation.sql`, `20261001155659_admin_content_v1.sql`.
- `src/modules/billing/domain/access.ts`, `src/server/billing/subscription-access.ts`, `src/server/practice/supabase-practice-repository.ts`, `src/server/notifications/cron-handler.ts`.

## Acceptance criteria

- [ ] `private.has_paid_access` nao libera usuario sem assinatura nem concessao ativa; libera concessao ativa; nega ACTIVE com `cancel_at_period_end` e `current_period_end <= now()`.
- [ ] Backfill `LEGACY_BACKFILL` cobre exatamente STUDENT sem assinatura com matricula ACTIVE.
- [ ] `start_practice_attempt` e a RLS de `practice_activities` exigem matricula ACTIVE/COMPLETED no curso da atividade (Teacher/Admin preservados).
- [ ] `confirm_placement_choice` aceita CANCELLED com periodo pago futuro.
- [ ] Concluir a ultima aula publicada grava `enrollments.status='COMPLETED'` uma unica vez; leitura de conteudo e progresso continuam para COMPLETED.
- [ ] RPCs de concessao e de matriculas sem turma exigem ADMIN + AAL2; concessao/revogacao geram audit log.
- [ ] Espelho TS (`deriveSubscriptionAccess`) igual a regra SQL, com teste unitario.
- [ ] `/support`, aviso em `/progresso`, "Curso concluido", card Admin e bloco de concessao implementados com primitivos existentes.
- [ ] `.github/workflows/notifications-cron.yml` agendado, sem actions de terceiros, falha sem segredo/URL.
- [ ] ADRs 0017-0019, docs de dominio e OPEN_QUESTIONS atualizados; failure-log + ratchet do furo "sem assinatura => acesso".
- [ ] No unrelated behavior regressed.

## Allowed files / domains

- `supabase/migrations/20261014120000_stage_11_access_closure.sql` (nova), `supabase/tests/*`, `scripts/run-sql-tests.mjs`, `scripts/setup-canonical-e2e.mjs` e scripts de concorrencia (fixtures).
- `src/modules/billing/**`, `src/server/billing/**`, `src/server/practice/**`, `src/server/learning/**`, `src/server/students/**`, `src/server/placement/**`, `src/modules/progress/**`, `src/modules/home/**`, `src/modules/learning/**`.
- Paginas: `src/app/(protected)/(student)/{home,progresso,pratica}`, `src/app/(protected)/support`, `src/app/(protected)/(admin)/admin/{enrollments,students}`, `src/app/(protected)/(teacher)/teacher/alunos/[studentId]`, `src/app/(commercial)/billing/return`.
- `tests/unit/**`, `tests/integration/**`, `tests/e2e/**` (somente extensoes).
- `.github/workflows/notifications-cron.yml` (novo).
- `docs/**`, `harness/**`.

## Forbidden areas

- Migrations ja aplicadas (somente migration aditiva nova).
- Webhook Asaas/reconciliacao (`reconcile_billing_event`) e checkout: fora do escopo.
- Canal de suporte, host de deploy, entitlements para concessoes: continuam em OPEN_QUESTIONS.
- Goldens/baselines visuais: nao promover sem evidencia de tela aprovada alterada.
- AAL2, RLS e privilegios nunca afrouxados para passar teste.

## Mandatory tests

- `npm run verify:agent`
- `npm run verify:db`
- `npm run verify:security`
- `npm run verify:ui`
- Suites SQL `access-closure`, `subscription-access`, `subscription-cancellation`; `tests/unit/subscription-access.test.ts`; `tests/integration/subscription-gate.test.ts`.
- `verify:full` no CI oficial da PR.

## Required evidence

- `harness/evidence/stage-11-flow-gap-closure/README.md` com comandos, resultados e run do CI oficial.
- Screenshots de `/support`, `/progresso` suspenso e card Admin.

## Definition of done

Done means every acceptance criterion passes, mandatory checks pass, evidence was inspected, decisions/progress were recorded, blockers/TODOs were registered, and `harness/feature_list.json` reflects the real state. A written claim without matching system state is not done.
