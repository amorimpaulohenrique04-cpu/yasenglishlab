# Plano — teacher-sessions-redesign

## Active task

**teacher-sessions-redesign**

Goal: harness/goals/teacher-sessions-redesign.md. Plano aprovado pelo usuário.

1. Projeções autenticadas completas e domínio/testes de filtros, disponibilidade e relatórios.
2. Agenda/calendário, assistente, drawers e detalhes preservando operações.
3. Relatórios CSV/PDF, regressões, acessibilidade e evidência visual.
4. Entrega local, migrations, dev-seed e localhost. Gates completos suspensos por instrução expressa de 2026-10-22; certificação permanece pendente. Sem PR ou push.

Fase 2 — polimento visual (aprovado 2026-10-22; visual+UX, sem regra nova; CTA violeta; motion):

1. Fundação: motion provider, tokens de mola, primitivos (SegmentedNav, Tabs underline, Breadcrumbs, Drawer sizes/footer, Dropdown estendido, ToastProvider, Stepper, CommandPalette). Popover, DatePicker, Combobox e Switch não foram necessários: inputs nativos estilizados mantêm a semântica e os testes.
2. Espaço de sessões (Hoje/Semana grade/Mês, toolbar instantânea, ⌘K, coluna lateral).
3. Sheets Meet e Disponibilidade (grade semanal).
4. Assistente de criação + edição em sheet.
5. Detalhes (cabeçalho com faixa de metadados, abas, presença otimista, recursos). Morph via ViewTransition descartado: nomes duplicados durante a animação de troca de visão.
6. Relatórios (KPIs, gráficos SVG animados, insights determinísticos).
7. Responsivo/a11y/reduced-motion, testes focados, evidência.

---

# Plano — public-site-design-refinement

## Active task

**public-site-design-refinement**

Goal: `harness/goals/public-site-design-refinement.md`. V4 aplicada; revisão visual e verify:ui pendentes. Core, harness e segurança passaram. Eval inclui commits preexistentes da branch fora do escopo desta tarefa.

---

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

---

# Plano — public-site-design-refinement

Goal: `harness/goals/public-site-design-refinement.md`.

1. Refinar apenas o protótipo público: hero editorial, benefícios discretos, método e professora mais cedo, planos e mobile.
2. Preservar preços/fluxo confirmado; substituir urgência simulada e depoimentos fictícios por conteúdo demonstrativo explícito.
3. Executar verify:agent e verify:ui, validar estrutura local e registrar limitações de revisão visual sem contornar bloqueio do navegador.

## teacher-practices-redesign — 2026-10-22

Approved stages: 0 preparation; 1 contracts; 2 SQL access/final submission; 3 list; 4 authoring/autosave; 5 player; 6 publication/polish; 7 verification. See harness/goals/teacher-practices-redesign.md and docs/TEACHER_PRACTICES_REDESIGN.md. Preserve preexisting work. Main owns shared contracts and migration; workers have disjoint files.

## 2026-10-22 — teacher-practices-redesign: lapidação visual/funcional (Claude)

Escopo: só UI do Teacher em `src/modules/teacher-operations/ui/practice-*` + `practices.module.css`/`practice-list.module.css` (e o player compartilhado só se o defeito for dele). Sem migration, sem regra de produto nova.
Gap matrix (inspeção Chrome 1440px vs referência):

1. Listagem: título grande demais vs Sessões; coluna de status no centro; ação "Continuar" para rascunho; menu ⋮ com Editar/Duplicar; chips de habilidade/nível.
2. Informações: breadcrumb quebrado em 2 linhas; ícone de "Visualizar como aluno"/"Nova questão" empilhado sobre o texto; contadores 0/100 e 0/200 à direita; confiança como switch com descrição; "Configurações adicionais" como link com chevron; Dica com ícone de alvo, não esticada.
3. Questões: lista com tile de ícone do tipo + "1. Tipo" + trecho; ações Duplicar/Excluir/↑↓ no cabeçalho do editor; mídia como 4 tiles ao lado do enunciado; toolbar com ícones; prévia em cartão limpo (sem caixa alta indevida, sem sobreposição do rodapé).
4. Tipos: "Nova questão" abre seletor antes de criar item; grade 4 colunas + Dica; sem rádio nativo visível; título com estilo de heading.
5. Feedback/configurações: dois cartões lado a lado quando abertos (abas "Por alternativa"/"Feedback geral"; pontuação, dificuldade, tempo, switches).
6. Revisão: checklist com resumos (contagem, mídias, configurações) e rodapé Voltar/Salvar rascunho/Publicar.
   Funcional: status "Salvo automaticamente há X min"; confirmação ao excluir questão; stepper mantém etapas futuras inertes (padrão Sessões).
   Delegação: Sonnet (yas-frontend) sequencial — A: Questões/tipos/feedback (3–5); B: cabeçalho/Informações/Revisão/Listagem (1,2,6). Gates e registros: Haiku. Revisão visual: principal no Chrome.

## teacher-practice-header — 2026-10-23

Goal: `harness/goals/teacher-practice-header.md`.

1. Reorganizar somente cabeçalho: breadcrumb independente, título/badge e status, ações com hierarquia.
2. Ajustar container queries para tablet/mobile usando os tokens e botões existentes.
3. Inspecionar no navegador, executar verify:agent/verify:ui e registrar evidência/bloqueios sem alterar trabalhos preexistentes.

## teacher-entry-demo — 2026-10-23

Goal: `harness/goals/teacher-entry-demo.md`.

1. Seed focado em quatro alunos Demo exclusivos, teste publicado e teacher.dev existente.
2. Criar assinatura sintética local e atribuições; executar comandos de placement/avaliação sem finalizar revisão.
3. Repetir para provar idempotência, consultar fila como teacher e inspecionar no navegador; executar checks e registrar pendências.

## teacher-entry-redesign — 2026-10-23

1. Projeções, rascunhos privados com versão e evidências autorizadas.
2. Fila e workspace de revisão conforme referência, motion e responsivo.
3. Smoke simples e registros; gates adiados por instrução do usuário; IA sem provedor.

## teacher-availability-redesign — 2026-10-23

1. Migration aditiva: ocorrências datadas, séries, pausa, lotes atômicos/idempotentes e cobertura de sessões.
2. Workspace responsivo conforme referência; calendário com seleção, formulário, sheets e lista.
3. Checks focados, smoke com rollback e browser; sem gates/build/commit/push.

## 2026-10-23 — teacher-students-redesign

1. Projeções autorizadas completas/paginadas para carteira, trilhas, feed e perfil, sem limites do contexto antigo.
2. Listagem no padrão visual da referência; perfil com quatro abas, sheets de nota/pedido e URL preservada.
3. Checks pequenos e smoke SQL transacional; conferir responsividade e registrar evidências. Sem gates/build/commit/push; verified:false.

## Teacher screens polish (2026-10-23)

0. Preparação mecânica: goal em harness/goals/teacher-screens-polish.md, código morto confirmado, runner SQL e helper de iniciais.
1. Cabeçalho e barra lateral: sidebar sem corte do cartão do usuário, menu do usuário e Ctrl K global.
2. Revisões de entrada: migration aditiva, fluxo de finalização com próxima revisão, UI conforme mock e modal de erro.
3. Disponibilidade: erros mapeados, KPIs corretos, agenda sem sobreposição, card de regras somente leitura e toggle estável.
4. Alunos: KPIs, ordenação, busca com debounce, ações por linha e paginação do perfil.
5. Testes: seletores atualizados sem enfraquecer asserções, e2e/a11y/componente novos, sem goldens automáticos.
6. Verificação: testes focados, verify:agent, verify:ui, verify:db, verify:security e verify:full, com evidências.
7. Proposta fora do ciclo: tendências/sparklines (snapshots) e sino de notificações.
   Detalhes e critérios: harness/goals/teacher-screens-polish.md.

## teacher-students-refinement — 2026-10-24

0. Preparação: goal em harness/goals/teacher-students-refinement.md, seção no plan.md e entrada no feature_list (in_progress, verified:false).
1. Dados: migration aditiva com `actions` priorizadas, aba `pending`, `placement_state`, filtro do feed com "Teste de entrada", `engagement` do perfil, testes SQL e docs.
2. Lista: painel "Próximas ações", tabela em largura total, três dimensões separadas, KPIs com base explícita, abas, "Visão da carteira" recolhível e acessibilidade.
3. Perfil: CTA contextual, menu "Mais ações", resumo de acompanhamento e progresso explicado.
4. Sidebar (item 13): reproduzir a 1440x900 e 768; corrigir só se não for artefato de captura.
5. Testes: unitários, e2e e a11y (axe e contraste) sem enfraquecer asserções nem atualizar goldens automaticamente.
6. Verificação: SQL suite, unitários, specs de Alunos, verify:db, verify:security, verify:ui e verify:agent, com evidências em harness/evidence/teacher-students-refinement/.
   Detalhes e critérios: harness/goals/teacher-students-refinement.md.

## teacher-cohorts-redesign — 2026-10-24

1. Preservar alterações preexistentes; referência HTML, contratos e contexto autorizado inspecionados.
2. Implementar cartões, indicadores, busca/ordenação e Drawer com primitivos existentes; sem comandos administrativos fictícios.
3. Verificar lógica, lint/types, responsividade/a11y e gates; registrar evidências e bloqueios.
