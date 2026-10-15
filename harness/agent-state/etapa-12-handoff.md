# Etapa 12 — Plano completo, estado atual e estratégia econômica para Codex

Atualizado em 2026-10-15. Branch `feat/etapa-12-lacunas-operacionais` (a partir de `f41d60f`, tip da Etapa 11). **Nada commitado ainda.** Goal: `harness/goals/stage-12-lacunas-operacionais.md`. Plano de sessão original: `C:\Users\PAULO HENRIQUE\.claude\plans\crie-um-plano-com-cached-engelbart.md`.

## 1. Objetivo e escopo vigente

Fechar as lacunas que impedem operar o produto. Por decisão de custo (2026-10-15, registrada em `decisions.md`), **esta PR entrega A, B, C e E**. **D e F saem para uma PR seguinte.**

| Bloco | O quê                                                                                                              | Nesta PR |
| ----- | ------------------------------------------------------------------------------------------------------------------ | -------- |
| A     | Professor cria, publica e atribui práticas dinâmicas por turma (URGENTE)                                           | sim      |
| B     | Admin cria e publica o teste de entrada (avaliação de entrada explícita)                                           | sim      |
| C     | Trilha da turma (ordem, liberação por data, sequência, itens exclusivos) e fechamento da leitura aberta de títulos | sim      |
| E     | Admin matricula aluno no próximo curso + aviso ao aluno concluído                                                  | sim      |
| D     | Admin edita direitos de plano (só direitos, sem preço)                                                             | adiado   |
| F     | Alertas operacionais na visão geral do Admin                                                                       | adiado   |

Decisões do usuário (não reabrir): conteúdo por turma = várias turmas por item com ordem + data + sequência; teste de entrada único e explícito; planos só direitos; próximo nível = Admin matricula + aviso; professor publica direto no próprio escopo; atribuição só por turma; formatos = estímulo (texto, imagem, áudio, vídeo) × resposta (escolha única, várias, V/F, lacunas, ordenar, escrever, falar). Escrever e falar vão para revisão humana, sem nota (ADR 0010). Redesign (`artifacts/`) **não** entra nesta PR.

## 2. O que já foi feito

### Harness e documentação

- Goal, `plan.md`, `decisions.md`, `feature_list.json` (entrada `in_progress`, `verified: false`).
- ADRs 0020 a 0023 escritos e indexados em `docs/adr/README.md`.

### Bloco A — Práticas do professor (código pronto; falta prova de UI)

- **Banco** (`supabase/migrations/20261015100000_stage_12a_practice_authoring.sql`, aplicada e verificada em banco limpo): autor/curso/audience em `practice_activities`, `cohort_practice_assignments`, `practice_activity_assets`, `private.is_teacher_for_course`, formato `content` v2, correção no banco dos 5 tipos objetivos, WRITTEN/SPOKEN na fila de revisão, RPCs `teacher_practice_*`, `student_assigned_practices`, `authorize_practice_asset`. Teste: `supabase/tests/practice_authoring.sql` (579 linhas), registrado em `scripts/run-sql-tests.mjs`.
- **Backend:** `src/modules/practice/domain/{content-v2,assignments,rubric,models}.ts`, `application/commands.ts`, `src/server/practice/{assets,practice,supabase-practice-repository}.ts`, `src/server/teacher-operations/{practice-commands,practice-scope,pedagogy}.ts`, actions em `teacher/praticas/actions.ts` e `teacher/revisoes/actions.ts`.
- **UI do aluno:** `PracticePlayer` (`src/modules/practice/ui/practice-*.tsx`), seção "Atribuídas a você" em `/pratica`, `submitPracticeV2Action`.
- **UI do professor:** item "Práticas" no menu, `/teacher/praticas` (lista), `nova` e `[id]` (construtor guiado em 6 passos com pré-visualização pelo mesmo player, upload de mídia, publicar e atribuir com prazo), `practice-builder{,-logic}.tsx`, `practice-asset-field.tsx`, `practice-publish-panel.tsx`.
- **Testes de app:** `practice-content-v2`, `practice-player-logic`, `practice-builder-logic` (unit) e `teacher-practice-commands` (integration).
- **Verificado por mim:** `typecheck` limpo, `eslint src tests --quiet` limpo, vitest `64 arquivos passaram | 1 ignorado; 532 testes passaram | 1 ignorado`.

### Bloco B — Teste de entrada (banco pronto; falta app)

- `supabase/migrations/20261015110000_stage_12b_assessment_authoring.sql`: `assessments.is_placement` + índice único parcial, backfill pela regra antiga, `start_placement_assessment` filtrando `is_placement`, RPCs `admin_assessment_list/get/save_draft/publish/new_version/retire`.
- `supabase/tests/assessment_authoring.sql` + registro; `placement.sql`, `test-placement-concurrency.mjs` e `setup-canonical-e2e.mjs` ajustados.
- **Resultado na stack isolada:** `assessment-authoring`, `function-privileges`, `placement`, `assessment_engine`, `practice_authoring`, `access_closure`, `admin_content`, `sensitive_tables_negative` e outras passam.

### Bloco C1 — NÃO INICIADO (parado a pedido do usuário)

Um agente de banco gastou 34 chamadas só lendo código e foi interrompido. **Não existe nada em disco**: nem `supabase/migrations/20261015120000_stage_12c1_cohort_path_model.sql` nem `supabase/tests/cohort_path.sql`, e `scripts/run-sql-tests.mjs` não tem a suíte `cohort-path`. O desenho está fechado no ADR 0022 e na seção "Bloco C" do plano de sessão; falta escrevê-lo.

Conteúdo previsto da migration: tabelas `cohort_paths` e `cohort_path_items` (sem DML direto), `audience` em módulos/aulas/materiais, predicados `student_path_includes`/`student_path_available`, aplicados em `can_read_lesson_asset`, `can_read_material`, `can_view_practice_activity` (partir da versão do 12a), `record_lesson_progress` e `complete_enrollment_on_last_lesson`, e por último as policies de `courses/modules/lessons` que fecham a leitura aberta de títulos, preservando o que o placement precisa.

## 3. O que falta

### Banco

1. **C1:** escrever do zero (ver seção acima). Dica de custo: escrever a migration **antes** de qualquer varredura ampla; copiar corpos de função com `grep -n` + `sed -n` de faixa curta. Depois, levantar os leitores do aluno que dependiam da leitura aberta (placement `src/server/placement/placement.ts:70`, home, agenda, learning) e testar cada um.
2. **C2** (`20261015130000_stage_12c2_cohort_path_admin.sql`, renumerar se necessário): `admin_cohort_path_get`, `admin_cohort_path_save` (substituição atômica, lock por turma, audit, "copiar do curso"), `get_student_learning_path(course)` com estado `AVAILABLE | LOCKED_DATE | LOCKED_SEQUENCE`. Teste SQL próprio.
3. **E** (`…_enroll_next_course.sql`): `admin_enroll_in_course(user, course, cohort, operation_id, reason, context)`, ADMIN+AAL2, curso ativo e publicado, turma ativa com vaga, reaproveita `private.activate_enrollment`, não encerra a matrícula `COMPLETED`, idempotente por `operation_id`, audit. Teste SQL.

### App

4. **Admin, uma única passada de UI** (padrão de `admin-content`, primitivos de `src/components/ui`, sem redesign):
   - `/admin/assessments{,/new,/[id]}` + item no `admin-shell.tsx` (editor de itens, publicar com `p_make_placement`, nova versão, aposentar);
   - `/admin/cohorts/[id]/trilha` (incluir/excluir, ordem, data de liberação, interruptor sequencial, copiar do curso);
   - seletor de público (`audience`) no editor de conteúdo;
   - formulário "Matricular em curso" em `/admin/students/[id]`;
   - editor de conteúdo admin: mostrar práticas v2 em somente leitura e remover a opção LISTENING inválida.
5. **Aluno:** `src/server/learning/supabase-learning-repository.ts` passa a consumir `get_student_learning_path` (aulas bloqueadas com motivo e data); Home e Progresso com curso concluído mostram "a equipe vai indicar seu próximo passo" + `/support`; garantir que o "curso atual" prefere `ACTIVE` a `COMPLETED` em `src/server/home` e `learning`.
6. **Vídeo como estímulo de prática:** hoje usa storage protegido com URL assinada, sem transcodificação (decisão no ADR 0020). Pipeline Mux das aulas fica como evolução.

### Testes, docs e evidência

7. Fixtures canônicas: `scripts/setup-canonical-e2e.mjs` (turma com trilha, prática atribuída, curso concluído); `assert-canonical-e2e.mjs` se necessário.
8. E2E: `tests/e2e/teacher-practices.spec.ts` (roteiro: professor cria prática de escolha única, salva, pré-visualiza, publica e atribui com prazo; aluno da turma responde; aluno de outra turma não vê; prática com tentativas só duplica); um e2e curto de admin para teste de entrada e trilha. Padrão `CANONICAL_E2E` de `tests/e2e/teacher-pedagogy.spec.ts`.
9. A11y (`tests/a11y/critical-flows.spec.ts`) para construtor de prática, editor de teste e trilha; screenshots desktop/tablet/mobile em `harness/evidence/stage-12-lacunas-operacionais/`.
10. Docs: `ADMIN_CONTENT`, `PRACTICE_ENGINE`, `PLACEMENT`, `AUTH_RBAC_RLS`, `DATA_MODEL`, `OPEN_QUESTIONS` (fechar "quem publica/edita avaliação" e "quando entra autoria do professor"; manter o restante); `harness/evidence/stage-12-lacunas-operacionais/README.md`; `progress.md`.
11. Não esquecer: `rls_permissions.sql` e `p21_core_experience.sql` falham na stack isolada por **resíduo de dados**, não por regressão (tentativa `SUBMITTED` commitada na atividade `82600000-…-0001`; colisão `lesson_single_video_v1`). Reconfirmar numa stack resetada.

### Gates finais (uma vez, no fim)

12. Resetar a stack isolada e rodar `npm run test:integration:db` e `npm run test:rls`.
13. `npm run verify:db`, `verify:security`, `verify:agent`, `CANONICAL_E2E=1 npm run verify:ui`.
14. `npm run verify:full`. **Sem ele a tarefa não é declarada verificada** e `feature_list.json` fica `verified: false`.
15. Revisão independente read-only (`yas-qa` no Claude Code, ou segunda sessão no Codex só para ler e rodar testes).

## 4. Riscos conhecidos

- **Fechar a leitura de títulos** (C1) pode quebrar leitores do aluno (placement, home, agenda). Testar cada um antes do merge.
- **Trilha própria muda quem conclui o curso:** conclusão automática precisa contar só as aulas da trilha (coberto no C1; exigir teste).
- **Etapa 11 ainda não está na `main`:** esta PR fica empilhada até o merge dela. Mergear a Etapa 11 antes é o recomendado.
- **UI sem prova visual:** construtor do professor e player do aluno passaram por typecheck/lint/unit, mas **não** por e2e, a11y nem navegador.
- Disco C: quase cheio: sem `next build`, sem instalações grandes. Docker pode cair com disco cheio.
- `setup-canonical-e2e.mjs` desmarca outra avaliação de entrada ativa no banco em que roda: só em banco E2E.

## 5. Estratégia econômica para rodar no Codex

O Codex lê o `AGENTS.md` da raiz (já é o mapa do projeto). O `CLAUDE.md` é só roteamento do Claude Code e **não** vale lá. Ao abrir a sessão, aponte este arquivo como contexto principal.

### Princípios

1. **Uma sessão = um bloco = uma entrega verificável.** Sessões curtas e com prompt fechado custam menos que uma sessão longa que acumula contexto. Termine cada sessão com commit local (se você autorizar), relatório curto e `git status` limpo para o escopo.
2. **Sem subagentes.** No Claude Code, cada agente começou "a frio" e releu o mesmo contexto; vários estouraram o limite de turnos. No Codex, trabalhe numa sessão só e resuma o estado em `harness/agent-state/progress.md` ao fechar.
3. **Esforço de raciocínio proporcional.** Use esforço baixo/médio para UI repetitiva, ajuste de fixtures, docs e testes unitários. Reserve esforço alto só para SQL com RLS/AAL2 e predicados de acesso (C1/C2) e revisão final. Escolha o modelo de código mais barato que fecha a tarefa; suba só se falhar duas vezes.
4. **Contexto mínimo.** Peça leitura de trechos (`rg`, `sed -n`), nunca de arquivos inteiros grandes. As migrations 12a (1042 linhas) e `practice-builder.tsx` (796) são moldes: ler só as seções citadas.
5. **Validação em dois níveis.** Por bloco: teste do bloco + `npm run typecheck` + `npx eslint src tests --quiet` + `npx prettier --check` nos arquivos tocados. Gates pesados (`verify:ui`, `verify:full`) **uma vez**, no fim.
6. **Banco:** nunca use o banco de desenvolvimento (tem MFA e fixtures). Use a stack isolada (`yastest12`, `postgresql://postgres:postgres@127.0.0.1:55422/postgres`; scratch em `…\scratchpad\dbtest\supabase`) e aplique migrations com `psql -1 -f`. Testes novos **transacionais** (`begin … rollback`) para não sujar a stack. Se a stack não existir mais, recriar com `supabase start --workdir` numa cópia de `supabase/` e portas alternativas.
7. **Aprovação e sandbox:** modo workspace-write com aprovação para comandos fora do repositório. Nada de commit, push ou merge sem o usuário pedir. Confira as flags exatas com `codex --help` (nomes variam por versão).
8. **Escrever antes de explorar.** Na prática, os agentes que começaram varrendo o repositório (C1: 34 chamadas, zero arquivos) gastaram tudo lendo. Peça o arquivo no primeiro terço da sessão, mesmo incompleto, e refine depois.
9. **Parar cedo se travar:** duas tentativas falhas na mesma causa → registrar em `harness/failure-log/` e reportar, em vez de insistir.

### Ordem das sessões (cada uma ~1 prompt)

| #   | Sessão                                                    | Esforço          | Entrega                                                      | Validação                                                                       |
| --- | --------------------------------------------------------- | ---------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| 1   | Escrever C1 (nada em disco ainda)                         | alto             | migration 12c1 + `cohort_path.sql`                           | suítes SQL na stack isolada                                                     |
| 2   | C2 SQL                                                    | alto             | RPCs admin + `get_student_learning_path`                     | teste SQL                                                                       |
| 3   | E SQL                                                     | médio            | `admin_enroll_in_course`                                     | teste SQL                                                                       |
| 4   | UI admin: teste de entrada + audience + remover LISTENING | médio/baixo      | `/admin/assessments*`, editor                                | typecheck, lint, unit                                                           |
| 5   | UI admin: trilha da turma + matricular no próximo curso   | médio/baixo      | `/admin/cohorts/[id]/trilha`, form em `/admin/students/[id]` | typecheck, lint, unit                                                           |
| 6   | Aluno: trilha com bloqueios + aviso de curso concluído    | médio            | repositório de learning + Home/Progresso                     | typecheck, lint, unit, integration                                              |
| 7   | Fixtures canônicas + e2e + a11y (professor, admin)        | médio            | specs + fixtures                                             | `CANONICAL_E2E=1` só dos specs novos                                            |
| 8   | Docs, evidência, ADR README, OPEN_QUESTIONS, progress     | baixo            | docs + evidence                                              | `format:check`, `eval:agent`                                                    |
| 9   | Gates finais numa stack resetada                          | baixo (só rodar) | evidência                                                    | `test:integration:db`, `test:rls`, `verify:db/security/agent/ui`, `verify:full` |
| 10  | Revisão read-only independente                            | médio            | achados                                                      | sem edição                                                                      |

### Modelo de prompt (copiar e preencher)

```
Leia AGENTS.md e harness/agent-state/etapa-12-handoff.md.
Tarefa: <sessão N>. Escopo de arquivos: <lista>. Não toque em mais nada.
Critério de aceite: <testes que devem passar>.
Moldes (ler só estes trechos): <arquivo:linhas>.
Restrições: não commitar; não alterar migrations já aplicadas; não afrouxar RLS/AAL2; banco só a stack isolada na porta 55422; nada de next build.
Ao terminar: relatório de até 20 linhas (arquivos, comandos com resultado real, decisões, pendências) e atualizar harness/agent-state/progress.md.
```

### Onde mais se economiza

- Rodar só o vitest dos arquivos tocados (`npx vitest run <arquivos>`) durante o bloco; a suíte inteira, uma vez antes de fechar a sessão.
- `npm run verify:full` e `verify:ui` só na sessão 9.
- Não regenerar nem promover goldens visuais sem evidência de tela aprovada alterada.
- Não reler `artifacts/`: não faz parte desta PR.

## 6. Próximo passo imediato

Escrever o C1 (migration `20261015120000_stage_12c1_cohort_path_model.sql`, `supabase/tests/cohort_path.sql` transacional, registro em `scripts/run-sql-tests.mjs`) e rodar as suítes na stack isolada. Depois, C2.

Observação sobre a stack isolada: verifique antes se ela ainda está de pé (`docker ps`, porta 55422). Ela tem resíduo de dados de suítes antigas (explica as falhas em `rls_permissions.sql:844` e `p21_core_experience.sql:137`).
