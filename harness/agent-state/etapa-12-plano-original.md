# Etapa 12 — Lacunas operacionais do SaaS (PR única)

## Context

Depois da Etapa 11 o fluxo do aluno fecha, mas o produto **não consegue ser operado**: a equipe não tem como criar o teste de entrada, o professor não tem como criar práticas, não existe conteúdo por turma e há buracos de lógica que o levantamento no código e no banco confirmou:

| #   | Lacuna confirmada                                                                                                                                         | Evidência                                                                                                  |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 1   | Professor não cria prática; prática não tem autor, escopo nem atribuição (todo aluno vê toda prática publicada do curso)                                  | `assert_content_admin` só ADMIN (`admin_content_v1.sql:82`); DML revogado; não há rota `/teacher/praticas` |
| 2   | Formatos de prática limitados a múltipla escolha e texto/áudio manual; LISTENING aceito na UI e rejeitado no SQL                                          | `validate_content` (`admin_content_v1.sql:132-146`)                                                        |
| 3   | Teste de entrada não tem editor nem RPC; só scripts de teste o criam; placement usa qualquer versão publicada de qualquer avaliação ativa                 | `stage_01_enrollment_core.sql:186`                                                                         |
| 4   | Conteúdo é escopado só por curso; sem ordem/liberação/sequência por turma                                                                                 | nenhuma tabela de conteúdo tem `cohort_id`                                                                 |
| 5   | Qualquer aluno logado lê títulos de cursos/módulos/aulas publicados de outros cursos                                                                      | policies `admin_content_v1.sql:58-63`                                                                      |
| 6   | Planos e direitos só mudam por migration                                                                                                                  | grants só SELECT; `seed.sql:4-47`                                                                          |
| 7   | Não há como matricular aluno em outro curso sem placement; concluir curso não leva a nada                                                                 | só `confirm_placement_choice` e `transfer_placement_cohort` inserem matrícula                              |
| 8   | Falhas silenciosas: turma sem horário nunca é oferecida; recomendação sem turma elegível trava o aluno; teste de entrada não publicado trava o onboarding | `admin_cohort_directory`, `get_placement_candidates`                                                       |

**Resultado esperado:** o professor cria, publica e atribui práticas dinâmicas às suas turmas; o admin cria e publica o teste de entrada, monta a trilha de cada turma (ordem, datas, sequência), edita direitos de plano, matricula no próximo curso e vê os alertas operacionais; o aluno vê só o que é dele.

## Decisões já tomadas pelo usuário

- Conteúdo por turma: **várias turmas por item**; admin controla **ordem + liberação por data + progressão sequencial por turma**.
- Teste de entrada: **um para todos, escolhido explicitamente**.
- Planos: **só direitos** (preço fora: reajuste é decisão separada em `docs/BILLING.md:53`).
- Próximo nível: **admin matricula + aviso ao aluno**.
- Prática: **professor publica direto no seu escopo**; **atribuição só por turma**; formatos: estímulo (texto, imagem, áudio, vídeo) × resposta (marcar, completar/ordenar, escrever/falar com revisão).
- A confirmar na aprovação: quem publica o teste de entrada = **ADMIN+AAL2** (coerente com ADR 0006; fecha a pergunta de `OPEN_QUESTIONS.md:26`).

## Escopo e fora de escopo

**Dentro:** blocos A–F abaixo, ADRs, docs, testes SQL/unit/integration/e2e/a11y, evidência visual.
**Fora (continuam em OPEN_QUESTIONS, sem inventar):** host de deploy, plataforma de aula ao vivo, canal de suporte e regularização de `PAST_DUE`, LGPD/retenção/menores, recuperação de MFA, troca de plano, preço, remarcação/reposição, reabertura de matrícula concluída.
**Também fora:** adoção do redesign (protótipos em `artifacts/`, que **não** entram nesta PR). As telas novas usam os primitivos atuais de `src/components/ui` e seguem `docs/UI_CONTRACT.md`, para o redesign reestilizar depois.

## Base e ordem

- Etapa 11 (5 commits em `fix/etapa-11-fechamento-fluxo`, tip `f41d60f`) **ainda não está na `main`**. Recomendado: mergear a Etapa 11 antes. Plano assume branch nova `feat/etapa-12-lacunas-operacionais` a partir do tip da Etapa 11 (PR empilhada até o merge, depois rebase).
- Migrations novas com timestamp **posterior a `20261014120000`**; uma por bloco, na ordem 12a→12f. Nenhuma migration antiga é editada. Funções redefinidas em mais de um bloco (ex.: `can_view_practice_activity`) usam `create or replace` e o bloco posterior parte da versão do anterior.
- Commits em ordem de prioridade; o **bloco A (prática) é autocontido** (migration, testes, UI próprios) e pode ser extraído sem retrabalho se a urgência pedir entrega antecipada.

## Bloco 0 — Harness e decisões (antes de qualquer código)

- `harness/goals/stage-12-lacunas-operacionais.md` a partir de `harness/GOAL.template.md`; cabeçalho `# GOAL — stage-12-lacunas-operacionais: …` **com travessão longo** (`scripts/eval-agent.mjs:58`); "Allowed files" cobrindo `supabase/**`, `src/**`, `tests/**`, `docs/**`, `scripts/setup-canonical-e2e.mjs`, `scripts/run-sql-tests.mjs`.
- `harness/feature_list.json` (entrada `in_progress`), `harness/agent-state/plan.md` com `## Active task` + `**stage-12-lacunas-operacionais**` (`eval-agent.mjs:46-49`), `decisions.md` com as decisões acima.
- ADRs (próximo número livre é 0020; `docs/adr/README.md` ganha as linhas):
  - **0020** — Autoria de prática pelo professor e atribuição por turma (substitui "Teacher/Support have no editorial grant" para práticas; ADR 0006 segue valendo para o resto).
  - **0021** — Teste de entrada: autoria admin e avaliação de entrada explícita.
  - **0022** — Trilha da turma (conteúdo por turma, ordem, liberação, sequência) e fechamento da leitura aberta de títulos.
  - **0023** — Matrícula administrativa no próximo curso e direitos de plano administráveis.
- `docs/OPEN_QUESTIONS.md`: fechar "quem publica/edita assessment" e "quando entra autoria do professor" (prática); manter o restante.

## Bloco A — Práticas do professor (URGENTE)

**Modelo (migration `…12a_practice_authoring`)**

- `practice_activities`: `+ created_by_teacher_id uuid null`, `+ course_id uuid null` (obrigatório para práticas de professor, derivado no RPC), `+ audience text default 'COURSE' check in ('COURSE','ASSIGNED')` (prática de professor nasce `ASSIGNED`: só aparece por atribuição). `skill` check passa a aceitar `WRITING`; `LISTENING` passa a ser válido no `validate`.
- `cohort_practice_assignments(cohort_id, practice_activity_id, assigned_by_teacher_id, due_at null, created_at, unique(cohort_id, practice_activity_id))`, RLS ligado, sem DML direto.
- `practice_activity_assets(id, practice_activity_id, asset_type IMAGE|AUDIO|VIDEO, storage_path, provider refs, upload_status, metadata)`; leitura só via URL assinada curta após `can_view_practice_activity`.
- Escopo do professor: helper novo `private.is_teacher_for_course(course)` derivado de turmas **ativas** em `cohort_teachers` (a `teacher_courses` é só informativa e nenhuma função a usa hoje). Reaproveita `private.current_teacher_id()` (`p21_teacher_operations_v2.sql:16-21`), `is_cohort_teacher` e `is_teacher_assigned` (`cohorts_v1_authorization_commands.sql:27-36`).

**Formato dinâmico: `content` v2** (os três `kind` legados continuam funcionando)

```
content = { version: 2,
  stimulus: { type: NONE|TEXT|IMAGE|AUDIO|VIDEO, text?, assetId?, transcript?, alt? },
  prompt, instructions?,
  response: { type, ... } }
```

| `response.type` | Aluno faz                                                       | Correção         | Gabarito (`private.practice_answer_keys.answer_key`) |
| --------------- | --------------------------------------------------------------- | ---------------- | ---------------------------------------------------- |
| `CHOICE_SINGLE` | marca uma                                                       | automática       | `{optionId}`                                         |
| `CHOICE_MULTI`  | marca várias                                                    | automática       | `{optionIds:[…]}`                                    |
| `TRUE_FALSE`    | verdadeiro/falso                                                | automática       | `{value:true\|false}`                                |
| `CLOZE`         | completa lacunas `{{1}}` no texto                               | automática       | `{blanks:[{id, accepted:[…], caseSensitive}]}`       |
| `ORDERING`      | ordena palavras/frases                                          | automática       | `{order:[ids]}`                                      |
| `WRITTEN`       | escreve (≤2000 car.)                                            | professor revisa | —                                                    |
| `SPOKEN`        | grava áudio (fluxo `reserve/complete_practice_audio` existente) | professor revisa | —                                                    |

Qualquer estímulo combina com qualquer resposta (vídeo+escrever, vídeo+falar, texto+marcar…). Sem nota agregada nem CEFR (ADR 0010). `feedback` correto/incorreto passa a ser **editável** (`admin_content_save` hoje não grava `feedback`).

**RPCs do professor** (padrão de `admin_content_v1.sql`: `security definer set search_path=''`, `pg_advisory_xact_lock`, audit em `audit_logs`, `revoke … from public, anon, authenticated` + `grant … to authenticated`):
`teacher_practice_list`, `teacher_practice_get` (só as próprias, devolve gabarito), `teacher_practice_save`, `teacher_practice_publish`/`unpublish`, `teacher_practice_duplicate`, `teacher_practice_assign(p_activity, p_cohort_ids[], p_due_at)`/`unassign`, `teacher_practice_reserve_asset`/`complete_asset`. Guard: `current_teacher_id()` (TEACHER+AAL2) + curso no escopo + turmas só as dele. Prática **com tentativas é imutável**: editar = duplicar. Publicar valida o formato v2 (função nova que delega para `validate_content` legado). Admin continua podendo despublicar qualquer prática por `admin_content_transition`.

**Entrega ao aluno**

- `private.can_view_practice_activity` (redefinida): prática `ASSIGNED` só visível a aluno com membership ativa em turma atribuída (`has_cohort_membership`, `stage_11:548`) + matrícula; histórico de tentativas continua legível (policy `stage_11:864`). `start_practice_attempt` (`stage_11:880`) e `submit_practice_attempt` (`practice_engine_v1:126-270`, verificar redefinições posteriores) estendidos para os tipos novos.
- Revisão: `get_teacher_reviews`/`finalize_practice_review` (`p21_pedagogy:120-150`) passam a incluir `WRITTEN` e qualquer skill com `PENDING_MANUAL` (hoje só SPEAKING/PRONUNCIATION); conferir a rubrica v1.
- Notificação in-app apenas; e-mail fora de escopo.

**App**

- Professor: item "Práticas" em `src/modules/teacher-operations/ui/teacher-shell.tsx:11-18`; rotas `src/app/(protected)/(teacher)/teacher/praticas/{page,nova,[id]}`; construtor guiado em passos (estímulo → tipo de resposta → gabarito/feedback → metadados → pré-visualização **com o mesmo renderizador do aluno** → publicar e atribuir com prazo); upload de imagem/áudio/vídeo; actions com `await assertRole("TEACHER")` na 1ª linha; comandos em `src/server/teacher-operations/practice-commands.ts` no molde de `session-commands.ts` (`withObservedSpan` + `rpc`); mapeamento de erros no molde de `supabase-admin-content-repository.ts:16-52`.
- Aluno: `src/modules/practice/domain/models.ts` (zod v2 + `recommendPractice` ciente de atribuições), `src/server/practice/supabase-practice-repository.ts`, `pratica/page.tsx` com seção "Atribuídas a você" (prazo e estado: nova, em andamento, concluída, atrasada) e widgets por tipo (ordenar com botões subir/descer além de arrastar; lacunas inline; transcrição do estímulo; legenda/alt obrigatórios no construtor com aviso).
- Vídeo: **spike inicial** em `src/server/media/**` (pipeline Mux das aulas) para decidir entre espelhar a tabela de vídeo ou generalizar; decisão no ADR 0020. Fallback documentado: arquivo em storage protegido com URL assinada, sem transcodificação.
- Admin Content: editor de prática (`content-editor.tsx:333-`) mostra o formato v2 em modo leitura e remove LISTENING inválido do select.

**Testes:** `supabase/tests/practice_authoring.sql` (matriz: professor dono/outro professor/aluno/admin/anon, AAL1 negado, escopo de curso e turma, `ASSIGNED` invisível sem atribuição, rascunho invisível, imutabilidade com tentativas, cada tipo de correção, vazamento de gabarito), registrada em `integration`, `rls` e entrada nomeada de `scripts/run-sql-tests.mjs`; `function_privileges.sql` e `sensitive_tables_negative.sql` atualizados; unit (zod v2, correção), integration (actions + `admin-action-guards`/`action-guards.test.ts:34` para o equivalente do professor), e2e novo em `tests/e2e/teacher-practices.spec.ts` (professor cria os 7 tipos, atribui, aluno da turma responde, aluno de outra turma não vê).

## Bloco B — Teste de entrada (editor admin)

**Migration `…12b_assessment_authoring`**

- `assessments.is_placement boolean default false` + índice único parcial (uma avaliação de entrada ativa). **Backfill determinístico:** marca a avaliação da versão hoje selecionada pela regra antiga, preservando o comportamento.
- `start_placement_assessment` (`stage_01:186`, única definição) passa a filtrar `is_placement`.
- RPCs ADMIN+AAL2 (`private.assert_content_admin`): `admin_assessment_list/get` (leitura de `answer_key`/`rubric`, que o PostgREST não expõe), `admin_assessment_save_draft` (assessment + versão + itens atômico), `admin_assessment_publish` (**repete as validações** de `start_assessment_attempt`, `assessment_engine_v1:104-167`: ≥2 opções com `id`+`label`, `answer_key.optionId` existente, SPEAKING/PRONUNCIATION só `MANUAL_TEXT`, ≥1 item; aposenta a versão anterior; audit `ASSESSMENT_PUBLICATION`, constante já existente em `src/server/audit/actions.ts:14`), `admin_assessment_new_version` (clona para DRAFT), `admin_assessment_retire` (bloqueia aposentar a única versão publicada da avaliação de entrada).
- Imutabilidade pós-publicação já garantida por `protect_assessment_version/item` (`create_domain_contracts.sql:476,513`).

**App:** `src/modules/admin-assessments/**` + `src/server/admin-assessments/**` (molde de `admin-content`), rotas `/admin/assessments{,/new,/[id]}`, item no `admin-shell.tsx:29-78`, editor de itens (tipo, skill, enunciado, opções, opção correta, rubrica), actions com `await assertRole("ADMIN")`.
**Fixtures/testes:** `scripts/setup-canonical-e2e.mjs` e `supabase/tests/{placement,assessment_engine}.sql` marcam a avaliação de entrada; novo `supabase/tests/assessment_authoring.sql` (publicar inválido falha, edição pós-publicação falha, só uma `is_placement`, placement ignora outras avaliações, negativos aal1/aluno/professor/anon); e2e: admin cria → publica → aluno novo inicia o teste.

## Bloco C — Trilha da turma (conteúdo por turma) + fechar leitura de títulos

**Regra (ADR 0022)**

- Cada turma segue o **curso padrão** ou uma **trilha própria**. Em trilha própria, o aluno vê **exatamente** os itens da trilha, na ordem da turma, respeitando liberação e sequência. Sem trilha própria: todo conteúdo do curso com `audience='COURSE'`; itens `audience='COHORTS'` (exclusivos) só aparecem para turmas que os incluem. Aluno sem membership ativa vê só `COURSE`.
- Sequência: quando ligada, a aula N+1 só abre depois de a N estar `COMPLETED` pelo aluno. Liberação por data: `available_from`.

**Migration `…12c_cohort_learning_path`**

- `cohort_paths(cohort_id pk, mode DEFAULT|CUSTOM, sequential bool, updated_at)` e `cohort_path_items(cohort_id, content_kind in modules|lessons|materials|practice_activities, content_id, position, available_from null)`; trigger valida que o item pertence ao **mesmo curso** da turma e que aula implica o módulo pai.
- `audience text default 'COURSE'` em modules/lessons/materials/practice_activities; adicionado em `private.content_fields` (`admin_content_v1.sql:68-80`) e aos schemas zod `.strict()` (`src/modules/admin-content/domain/models.ts`, `form-data.ts`, `content-editor.tsx`).
- Dois predicados novos: `private.student_path_includes(kind,id,user)` (metadados visíveis, inclui itens bloqueados) e `private.student_path_available(kind,id,user)` (assets/progresso). Entram em `can_read_lesson_asset`, `can_read_material` (`stage_11:264,238`), `can_view_practice_activity`, `record_lesson_progress` (`stage_11:283`) e nas policies de `courses/modules/lessons` (substituem a leitura aberta de `admin_content_v1.sql:58-63`; `courses` continua legível para o curso recomendado ao aluno no placement; TEACHER/ADMIN inalterados).
- `complete_enrollment_on_last_lesson` (`stage_11:771-810`) passa a contar **só as aulas da trilha do aluno** (sem isso o aluno de turma customizada nunca conclui, ou a função `security definer` conta tudo).
- RPCs admin: `admin_cohort_path_get`, `admin_cohort_path_save` (substituição atômica com lock por turma, audit, "copiar do curso"), `get_student_learning_path(course)` (ordem da turma + estado `AVAILABLE|LOCKED_DATE|LOCKED_SEQUENCE`).
- Transferência de turma: progresso fica por matrícula/aula; conclusão recalcula pela trilha nova.

**App:** `src/server/learning/supabase-learning-repository.ts:88-150` passa a consumir `get_student_learning_path` (mostra aulas bloqueadas com motivo e data); materiais/prática quase não mudam (RLS corta). Admin: nova rota `/admin/cohorts/[id]/trilha` (incluir/excluir, arrastar ordem de módulos e aulas, data de liberação, interruptor "sequencial", "copiar do curso", pré-visualização como aluno), seletor de público no editor de conteúdo.
**Testes:** `supabase/tests/cohort_path.sql` (matriz: turma padrão/própria, sem membership, exclusivo, bloqueio por data e por sequência, transferência, TEACHER/ADMIN/anon/aal1, **vazamento de títulos fechado**, progresso e asset bloqueados, conclusão automática com trilha); varrer leitores que dependiam da leitura aberta (placement, home, agenda, `src/server/placement/placement.ts:70`); e2e: admin monta trilha → aluno vê ordem e bloqueios.

## Bloco D — Direitos de plano (admin)

Migration `…12d`: `admin_plan_list`, `admin_plan_set_entitlement(plan, entitlement, limit, cadence, effective_from, context)` — ADMIN+AAL2, lock do plano, `effective_from >= now()`, fecha a linha aberta e insere a nova (índice `plan_entitlements_one_open_version`), idempotente se igual, audit (`ENTITLEMENT_CHANGE`, `audit/actions.ts:11`; o trigger `plan_entitlements_audit` já registra). Histórico das reservas preservado por `plan_entitlement_id_used`/`usage_limit` (`20261002042103:29`). UI em `/admin/billing` (aba Planos): vigente × agendado, sem edição de preço. Docs: `BILLING.md` registra que reset local com `seed.sql` (`on conflict … do update`) desfaz edições. Testes `supabase/tests/plan_entitlement_admin.sql`.

## Bloco E — Próximo curso

Migration `…12e`: `admin_enroll_in_course(user, course, cohort, operation_id, reason, context)` — ADMIN+AAL2; curso ativo+publicado; turma ativa do curso com capacidade (trigger `placement_capacity_guard` existente); reaproveita `private.activate_enrollment` (`stage_06a:21`); matrícula antiga **não é encerrada** (COMPLETED + ACTIVE coexistem, `has_course_enrollment` já aceita ambos); idempotência por `operation_id` em tabela própria (`unique`, conflito de parâmetros falha); audit. UI: formulário no detalhe do aluno (`/admin/students/[id]`). Aluno: Home/Progresso com curso concluído mostram "a equipe vai indicar seu próximo passo" + `/support`; verificar que o "curso atual" prefere `ACTIVE` sobre `COMPLETED` em `src/server/home` e `learning`. Testes SQL + unit + e2e.

## Bloco F — Alertas operacionais

Migration `…12f`: `admin_operational_alerts()` (read-only, ADMIN+AAL2, **uma** chamada): turmas ativas sem `cohort_placement_settings`; casos `PLACEMENT_READY/STUDENT_DECISION` sem turma elegível com a causa (sem turma do curso, sem horário, sem vaga, sem compatibilidade — mesmo predicado de `placement_cohort_compatible`, `stage_01:220`); revisão de entrada parada >3 dias e escolha de turma parada >7; **teste de entrada não publicado**; alunos que concluíram curso sem próxima matrícula. UI: cartões em `src/app/(protected)/(admin)/admin/page.tsx` (`metrics` :31, `priorityTasks` :91) dentro do `Promise.all` existente, respeitando `harness/failure-log/2026-10-05-admin-overview-e2e-budget.md`. Testes SQL + integration + e2e.

## Reaproveitar (não reescrever)

`private.assert_content_admin`/padrão de RPC (`admin_content_v1.sql:82,190-275`), `private.has_role(x,true)` (AAL2), `current_teacher_id`, `is_cohort_teacher`, `is_teacher_assigned`, `has_cohort_membership` (`stage_11:548`), `has_course_enrollment` (`:224`), `activate_enrollment`, `placement_cohort_compatible`, `reserve/complete_practice_audio`, `finalize_practice_review`, camadas `src/server/*` + `src/modules/*` do admin-content e do teacher-operations, `src/components/ui` (`DataTable`, `DetailDrawer`, `FormDialog`, `Alert`, `EmptyState`…), `withObservedSpan`, `getRequestTechnicalContext`.

## Verificação (ponta a ponta)

1. **Banco:** Docker + Supabase local; `npm run verify:db`, `npm run test:integration:db`, `npm run test:rls` (suítes novas registradas em `scripts/run-sql-tests.mjs`; `function_privileges.sql` sem função exposta a anon/PUBLIC).
2. **Código:** `npm run test:unit`, `test:integration`, `typecheck`, `lint`, `format:check`; `npm run verify:agent` (inclui `eval:agent`: escopo, evidência visual, migration para mudança de banco, teste RLS para policy).
3. **UI/segurança:** `CANONICAL_E2E=1 npm run verify:ui` e `npm run verify:security`; a11y (`tests/a11y/critical-flows.spec.ts` + novas telas: construtor de prática, editor de teste, trilha da turma); prints desktop/tablet/mobile em `harness/evidence/stage-12-lacunas-operacionais/`.
4. **Gate de release:** `npm run verify:full` antes de marcar `done`/`verified`; sem ele a tarefa não é declarada verificada.
5. **Roteiro manual no navegador (dev em `localhost:3000`, usuários canônicos):**
   - professor cria um exemplo de cada formato → pré-visualiza → atribui a uma turma com prazo → aluno da turma responde e vê o resultado → aluno de outra turma e professor de outra turma **não** acessam;
   - admin cria o teste de entrada → publica → aluno novo conclui o teste → professora revisa;
   - admin monta a trilha de uma turma (ordem, data, sequência) → aluno vê bloqueios e conclui o curso;
   - admin agenda mudança de direito de plano; matricula aluno concluído no próximo curso; confere os alertas.
6. **Evidência:** `harness/evidence/stage-12-lacunas-operacionais/README.md` com comandos e resultados reais; `progress.md`/`decisions.md` atualizados; falha repetível vira ratchet (`harness/ratchet.md`).

## Riscos

- **PR grande:** mitigação com migrations e testes por bloco e ordem por prioridade (bloco A extraível).
- **Vídeo como estímulo** é o item mais incerto (pipeline Mux das aulas); spike no início e fallback documentado.
- **Fechar leitura de títulos** pode quebrar leitores que dependiam dela (placement, home, agenda); coberto por varredura e testes antes do merge.
- **Trilha própria muda quem conclui o curso**; coberto por teste da conclusão automática.
- **Imutabilidade pós-tentativa** de prática e de teste obriga "duplicar"; comunicar na UI.
