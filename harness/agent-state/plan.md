# Plano — billing-reconciliation-integrity

## Active task

**billing-reconciliation-integrity**

1. Base limpa e CI verde confirmados; registrar regressões vermelhas.
2. Corrigir quatro arquivos existentes e feedback, sem SQL ou mutações financeiras.
3. PR #83 aberto em draft. CI 39081037545 bloqueado por colisão preexistente de janelas do rate limiter; verify:ui local bloqueado por progresso canônico visível após persistência. Concluir a execução única do verify:full, registrar evidência final e manter sem merge. Correções fora do billing exigem trabalho dedicado; sem bypass ou retry para ocultar o problema.

---

# Plano — PR #80 gates (pr80-gates)

## Active task

**pr80-gates** — goal: `harness/goals/pr80-gates.md`.

1. Conferir logs originais, contratos, fixtures e implementação; preservar alterações preexistentes.
2. Corrigir jornada canônica/retomada/persistência e estado de finalização com regressão.
3. Preparar acesso legítimo de áudio e acompanhar navegação real no a11y; preservar negativos.
4. Diagnosticar build visual comparando jobs e builds limpos; corrigir somente causa comprovada.
5. Executar gates em stack descartável, inspecionar diferenças visuais e registrar bloqueios/aprovações pendentes.

---

# Plano — Prática 10/10 (practice-10-v3)

## Active task

**practice-10-v3**

Goal: `harness/goals/practice-10-v3.md`. Fase 0 concluída em `practice-10-phase-0`; Fases 1–4 num PR único com commits por área, gates pesados no fim.

---

# Plano — Prática 10/10, Fase 0 (practice-10-phase-0)

Goal: `harness/goals/practice-10-phase-0.md`. Branch `feat/practice-10-phase-0` a partir de `c98a33d` (redesign rodada 4). Plano completo: `C:\Users\PAULO HENRIQUE\.claude\plans\crie-um-plano-para-serialized-umbrella.md`.

1. Migration `stage_13a_practice_lifecycle` (yas-database): colunas de tentativa, limpeza de duplicatas, índice único parcial, `practice_lesson_reached`, `start_practice_attempt` com retomada/expiração/bloqueio; teste SQL `practice_lifecycle.sql`.
2. Domínio/UI: `grouping.ts` com `reachable`, chave de início estável, CTA primária única, resumo com janela de 7 dias e rótulo de estimativa, progresso acessível, texto do resultado incorreto.
3. Testes unit/integration/a11y, gates verify:db/security/ui/agent, resolver os 3 registros de failure-log de 2026-10-16.

---

# Plano — Refinamento UI aluno (student-ui-refinement)

Goal: `harness/goals/student-ui-refinement.md`. Branch `feat/ui-redesign`. Só apresentação.

Status 2026-10-15: A–F implementados; Prática refeita (aula em destaque + grade de atividades, filtro em painel) e Agenda com mais respiro após feedback. tsc/eslint dos arquivos alterados OK, unit learning-lesson-access OK. verify:ui/e2e NÃO rodados (usuário pediu sem testes grandes); e2e de Agenda atualizados para o card reservado sem botão "Reservado". Vínculo prática→aula já existe no construtor do professor ("Aula relacionada"). Rodada 4 (2026-10-16): prática em rota própria de tela cheia `/pratica/[attemptId]` (grupo `(practice-focus)`, mesma guarda de aluno; `?attempt=` legado redireciona); peças compartilhadas em `pratica/_practice/`. Player redesenhado para todos os tipos (opções em cartão A/B/C, V/F, lacunas, ordenação com setas, escrita, gravador com ação única), resultado premium com próxima atividade/praticar de novo, histórico retomável, biblioteca por módulo→aula, View Transitions (entrada/saída do palco, volta, crossfade destaque⇄biblioteca) e details animados. E2E ajustados às novas URLs/rótulos (não executados). Pendente: retomar tentativa IN_PROGRESS ao clicar Praticar (backend; hoje cria duplicatas). ADR 0024 da prova multi-etapas na branch claude/practice-exam-adr-710630 (proposto, não mesclado).

Rodada 3: "Atribuídas" vira faixa discreta quando vazia e cards com prazo em destaque quando há tarefas; visão `/pratica?todas=1` (biblioteca por aula) com convite "Ver todas as práticas por aula"; filtro por habilidade abre a visão completa. tsc/eslint OK.

A. Perfil na sidebar (RoleShell, todos os papéis). B. Aulas: CTA por aula, resumo sem descrição de seed. E. Progresso: painéis alinhados. D. Materiais: toolbar e colunas de linha. F. Agenda: hierarquia de ações. C. Prática: nota removida, "Pratique o que você estudou" por aula vinculada, habilidades em chips. Verificação: browser 3 viewports, verify:agent, verify:ui.

---

# Plano — PR 74 gates

## Active task

**pr74-gates**

Goal: `harness/goals/pr74-gates.md`.

1. Reproduzir falhas em stack local isolada.
2. Corrigir contraste, reflow, foco e expectativas de UI; isolar dados mutáveis.
3. Separar goldens e atualizar referências aprovadas após revisão.
4. Eliminar retries, centralizar setup Preview, validar relatórios e agregadores.
5. Verificar agent/UI/full; publicar e acompanhar CI; registrar evidência.

---

# Plano - Redesign da UI (ui-redesign-approved-proposal)

## Active task

**ui-redesign-approved-proposal**

Goal: `harness/goals/ui-redesign-approved-proposal.md`. Branch `feat/ui-redesign` a partir de `main` (30aa75a, Etapa 12 mergeada). Commits por fase.

0. Fundação: tokens remapeados, Montserrat + Inter via next/font/local, assets placeholder em `public/brand`, ícones, shell (sidebar/topbar/tab bar), nav centralizada por papel, primitivos, Storybook.
1. Aluno: home, aulas, aula, prática, materiais, progresso, agenda, perfil/support/onboarding, gate de assinatura.
2. Professor: início, sessões, nova sessão, turmas, alunos, revisões, entrada, disponibilidade, práticas.
3. Admin: visão geral, matrículas, alunos, turmas, professores, leads, pagamentos, conteúdos, teste de entrada.
   Por fase: typecheck, lint, unit, storybook:build, e2e/a11y das áreas, goldens das telas redesenhadas, evidência em `harness/evidence/ui-redesign-approved-proposal/`.

Regra: só apresentação; sem dado inventado; sem tocar server/RLS/actions.

---

# Plano anterior - Etapa 12 (stage-12-lacunas-operacionais)

## Previous task

**stage-12-lacunas-operacionais**

Goal: `harness/goals/stage-12-lacunas-operacionais.md`. Branch `feat/etapa-12-lacunas-operacionais` a partir do tip da Etapa 11 (f41d60f), PR unica empilhada, commits por bloco.

0. Harness, ADRs 0020-0023 e decisoes.
   A. (URGENTE) Praticas do professor: migration `20261015100000_stage_12a_practice_authoring.sql`, RPCs `teacher_practice_*`, formato `content` v2, atribuicao por turma, construtor e renderizador do aluno, testes.
   B. Teste de entrada: `20261015110000_stage_12b_assessment_authoring.sql`, `assessments.is_placement`, RPCs `admin_assessment_*`, editor admin.
   C. Trilha da turma + fechar leitura de titulos: C1 `20261015120000_stage_12c1_cohort_path_model.sql` e C2 `20261015130000_stage_12c2_cohort_path_admin.sql`.
   D. Direitos de plano: `20261015180920_stage_12d_plan_entitlement_admin.sql` (implementado na sessao Codex; entra nesta PR).
   E. Proximo curso: `20261015140000_stage_12e_admin_enroll_next_course.sql`.
   F. Alertas operacionais: `20261015180924_stage_12f_operational_alerts.sql` (implementado na sessao Codex; entra nesta PR).
   G. Validacao: verify:db/security/agent/ui, verify:full, evidencia e revisao yas-qa (read-only).

Plano detalhado da sessao: `C:\Users\PAULO HENRIQUE\.claude\plans\crie-um-plano-com-cached-engelbart.md`.

Estrategia de custo (2026-10-15): esta PR entrega A, B, C e E. D e F saem para uma PR seguinte. Um agente de banco por bloco; uma unica passada de UI admin para B, C e E; gates pesados (`verify:ui`, `verify:full`) uma vez no fim.

## Sessao C1 — 2026-10-15

Escopo: migration 12c1 nova, supabase/tests/cohort_path.sql, registro SQL e estado/evidencia harness. Implementar modelo/predicados, integrar leitores/progresso/conclusao, testar na stack 55422. C2, app e gates finais ficam para as sessoes seguintes; sem commit ou build.

## Sessao C2 — 2026-10-15

Escopo: nova migration `20261015130000_stage_12c2_cohort_path_admin.sql`, teste transacional
`supabase/tests/cohort_path_admin.sql`, registro em `scripts/run-sql-tests.mjs`, contrato RPC em
`docs/COHORT_PATH.md` e estado/evidencia harness. Entregar admin_cohort_path_get/save,
copia do curso e get_student_learning_path com estado e data efetiva de bloqueio.
Validar ADMIN+AAL2, isolamento, atomicidade, audit, lock por turma, conclusao apos edicao e regressao C1.
Nao alterar migrations aplicadas; stack 55422 somente, sem commit/build/subagentes. E e UI seguem fora desta sessao.

C2: incluir tambem `docs/README.md` no escopo para indexar o novo contrato de trilha.

C2 implementado e validado localmente: RPCs Admin/Aluno, teste transacional e contrato em docs/COHORT_PATH.md.
Proximo bloco: E SQL. Gates finais e estado in_progress/verified:false preservados.

## Sessao E SQL — 2026-10-15

Escopo: nova migration `20261015140000_stage_12e_admin_enroll_next_course.sql`, teste transacional
`supabase/tests/admin_course_enrollment.sql`, registro em `scripts/run-sql-tests.mjs`, contrato em
`docs/PLACEMENT.md` e estado/evidencia harness. Implementar admin_enroll_in_course com ADMIN+AAL2,
curso publicado/ativo, turma ativa com capacidade configurada/vaga, activate_enrollment,
idempotencia com conflito de parametros e audit. Preservar matriculas concluidas e historico.
Somente stack 55422; sem alterar migrations anteriores, sem commit/build/subagentes. UI/aviso ficam nas sessoes 5–6.

E SQL implementado e validado localmente: admin_enroll_in_course, recibo imutavel, teste transacional,
provas de concorrencia e contrato em docs/PLACEMENT.md. Proximo bloco: sessao 4, UI Admin de assessments/audience.
Estado da Etapa 12 continua in_progress/verified:false; gates finais seguem pendentes.

## Fechamento A e B — 2026-10-15

Pedido: concluir A (praticas do professor) e B (teste de entrada), sem expandir para UI C/E.
Escopo: src/modules/admin-assessments/**, src/server/admin-assessments/**,
src/app/(protected)/(admin)/admin/assessments/**, menu admin-shell; correcoes necessarias em
practice/teacher-operations/admin-content; tests/{unit,integration,e2e,a11y}/**, fixtures/scripts
canonicos e configs de teste quando necessarios para stack isolada; docs/{ADMIN_CONTENT,PRACTICE_ENGINE,
PLACEMENT,AUTH_RBAC_RLS,DATA_MODEL,OPEN_QUESTIONS}.md e harness. Migration aditiva somente se houver defeito comprovado.
Aceite: Admin cria/edita/publica/versao/aposenta; placement usa avaliacao explicita; professor cria/publica/atribui,
aluno responde e aluno/professor fora do escopo nao acessam; prova E2E/a11y e telas desktop/tablet/mobile.
Sem commit, sem build Next, sem banco dev; stack 55422/55421. Preservar alteracoes existentes e baselines aprovados.

A/B: next.config.ts incluido para desativar apenas cache persistente Turbopack em YAS_ISOLATED_VERIFY, apos erro real os112. Limpeza somente do cache gerado .next-p18/dev/cache/turbopack, caminho absoluto verificado.

A/B concluídos localmente: E2E 2/2, a11y 4/4, axe e screenshots nos três viewports, SQL e checks registrados. Próximo: UI C/E e fechamento macro; não executar build/commit sem nova autorização.

## D/F — pedido expresso do usuário (2026-10-15)

D e F deixam de estar adiados nesta sessão. Implementar admin_plan_list/set_entitlement e editor em /admin/billing?tab=plans, apenas direitos com vigência futura e histórico de reservas intacto; admin_operational_alerts read-only ADMIN+AAL2 em uma RPC e cartões na visão geral com causas do matching existente, revisão >3 dias, escolha >7 dias, entrada não publicada e concluído sem próxima matrícula. Escopo: migrations aditivas geradas pelo CLI, supabase/tests, registro SQL, src/modules/admin-plans/** e admin-overview, src/server/{admin-plans,admin-overview}/**, rotas Admin billing/overview e respectivas ações, testes unit/integration/SQL/E2E/a11y, docs BILLING/PLACEMENT/AUTH_RBAC_RLS/DATA_MODEL e harness. Não editar preço, webhook ou migrations anteriores; sem subagentes, next build ou banco dev. Commit/push/PR autorizados expressamente, sem merge. PR atual permanece rascunho enquanto C/E UI e gates macro estiverem pendentes.

Plano: 1 SQL D/F com negativos/atomicidade/histórico; 2 adaptadores e UI usando primitivos atuais; 3 testes focados, prova E2E/a11y/screenshots; 4 documentação/evidência, commits e atualização da PR.

Atualizacao (2026-10-15): o Codex implementou D e F; o corte de custo que os adiava foi revogado de fato. D e F entram nesta PR. Falta UI de C/E (trilha admin, matricular, trilha do aluno), docs e gates finais.

## Retomada: duas falhas finais do CI

Corrigir o bloqueio de chunks minificados no teste de hidratação e executar apenas o checkout FAKE em servidor dev isolado, preservando a proibição de FAKE em produção. Validar os dois casos, controles e CI completo.

Ajuste final de integração: mover a prova de persistência/audit de publicação do pós-run para o próprio cenário, antes de afterEach limpar o módulo. Manter as mesmas asserções e deixar os demais checks de persistência/analytics intactos.
