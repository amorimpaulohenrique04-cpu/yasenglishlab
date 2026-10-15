# Etapa 12 — evidencia local A/B e C1/C2/E SQL (2026-10-15)

Estado: implementacao C1 testada localmente; Etapa 12 continua `in_progress`, `verified: false`.
Nenhum commit, build, deploy ou alteracao no banco de desenvolvimento.

## Entrega

- Migration `20261015120000_stage_12c1_cohort_path_model.sql`: caminhos DEFAULT/CUSTOM,
  audience COURSE/COHORTS (preserva ASSIGNED), ordem/data/sequencia, referencias de mesmo curso
  e pais obrigatorios, tabelas com RLS e sem acesso direto pelo Data API.
- Predicados privados aplicados a metadados, assets, materiais, praticas e progresso.
  Conclusao automatica conta somente aulas publicadas incluidas na trilha.
  Matricula COMPLETED conserva a trilha; nao reabre automaticamente.
- Referencias impedem remover/mover conteudo ainda incluido numa trilha.
- `cohort_path.sql` transacional registrado em integration, rls e alias `cohort-path`.

## Comandos e resultados reais

Todos os comandos SQL utilizaram exclusivamente `127.0.0.1:55422`, container `supabase_db_yastest12`.

| Comando                                                                                                                             | Resultado                                                                                          | Evidencia                             |
| ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `psql -X -v ON_ERROR_STOP=1 -1 -f supabase/migrations/20261015120000_stage_12c1_cohort_path_model.sql`                              | exit 0; seguido de refinamentos locais de funcoes/triggers                                         | replay integral abaixo                |
| Replay da migration final a partir do schema anterior ao C1 + teste completo, dentro de transacao terminada em ROLLBACK             | exit 0                                                                                             | `c1-replay.log`                       |
| `node scripts/run-sql-tests.mjs cohort-path`                                                                                        | exit 0                                                                                             | `c1-cohort-path.log`                  |
| Mesmo runner: practice-authoring, access-closure, function-privileges, assessment-authoring, sensitive-tables-negative              | todos exit 0                                                                                       | `c1-*.log` de cada suite              |
| `psql -X -v ON_ERROR_STOP=1 -f supabase/tests/{placement,cohorts,admin_content,assessment_engine}.sql` (cada arquivo separadamente) | todos exit 0                                                                                       | respectivos `c1-*.log`                |
| `node node_modules/typescript/bin/tsc --noEmit`                                                                                     | exit 0                                                                                             | `c1-typecheck.log` (sem diagnosticos) |
| `node node_modules/eslint/bin/eslint.js src tests --quiet`                                                                          | exit 0                                                                                             | `c1-eslint.log` (sem diagnosticos)    |
| `node node_modules/vitest/vitest.mjs run`                                                                                           | exit 0; 64 arquivos passaram, 1 ignorado; 532 testes passaram, 1 ignorado                          | `c1-vitest.log`                       |
| `node scripts/verify-db.mjs`                                                                                                        | exit 0                                                                                             | `c1-verify-db.log`                    |
| `node scripts/verify-security.mjs`                                                                                                  | exit 0                                                                                             | `c1-verify-security.log`              |
| `node scripts/verify-harness.mjs`                                                                                                   | exit 0                                                                                             | `c1-verify-harness.log`               |
| `node scripts/eval-agent.mjs`                                                                                                       | exit 1; compara commits com origin/main, inclui Etapa 11 e nao inspeciona o C1 ainda nao commitado | `c1-eval-agent.log`                   |
| `psql ... -f supabase/tests/schedule_booking.sql`                                                                                   | exit 3; sessao reservada imutavel na linha 107                                                     | `c1-schedule_booking.log`             |
| Mesma suite de agenda com C1 removido somente dentro de transacao, rollback ao encerrar                                             | mesmo exit 3 e mesma funcao protect_reserved_session                                               | `c1-schedule-before.log`              |

Replay: restaurou as cinco funcoes/policies anteriores, removeu somente objetos C1 na transacao,
executou a migration final inteira e o teste sem transacoes aninhadas; ROLLBACK preservou o banco.
Nao equivale ao reset integral da stack exigido na sessao de gates finais.

## Inspecao de leitores e limites

- Placement de professor (`src/server/placement/placement.ts:70`) mantem leitura de cursos publicados por TEACHER+AAL2.
  Teste SQL preserva o titulo recomendado ao aluno, sem liberar modulos/aulas do curso recomendado.
- Home delega ao SupabaseLearningRepository, que consulta cursos por matricula e modulos/aulas por seus pais.
  A nova RLS filtra esses leitores; ordem/bloqueios da turma ainda dependem do RPC C2 e da sessao 6.
- Agenda usa `get_agenda_sessions_v2`; a regressao SQL de reserva nao chegou ao fluxo de leitura,
  por colisao de fixture preexistente confirmada sem C1. Repetir em stack resetada.
- Transferencia preserva progresso por aluno/aula e reavalia imediatamente a conclusao ao ativar a membership.
  O teste comprova conclusao auditada ao transferir para uma trilha ja concluida, sem fabricar checkpoints.
  C2 deve chamar `private.complete_path_enrollment(uuid)` apos salvar uma trilha alterada.
- `private.content_fields` e schemas/editor de audience continuam para a sessao de UI admin.
- `verify:agent`/`verify:ui`/`verify:full`, reset e revisao independente seguem pendentes conforme handoff.
  `verify:agent` envolve build, expressamente proibido nesta sessao.
- `npm`/`npx` globais apontam para arquivos ausentes em AppData/Roaming/npm;
  ferramentas locais foram executadas por Node, sem instalar ou modificar dependencias.

Pendencias detalhadas: `harness/failure-log/2026-10-15-stage-12c1-local-validation.md`.

## Verificacao final complementar

`node scripts/test-course-completion-concurrency.mjs`: exit 0; duas aulas finais concorrentes,
sem deadlock, uma conclusao e uma auditoria. Evidencia: `c1-completion-concurrency.log`.
O script existente deixa fixture com UUIDs aleatorios somente na stack isolada; reset final obrigatorio.
O novo teste `cohort_path.sql` sempre termina em rollback.

`node node_modules/prettier/bin/prettier.cjs --check` nos arquivos JS/Markdown/JSON tocados: exit 0
(`c1-format.log`). Nao ha plugin de formatacao SQL no projeto.

## C2 — RPCs de trilha (2026-10-15)

Entregues `20261015130000_stage_12c2_cohort_path_admin.sql`, teste independente/transacional
`cohort_path_admin.sql`, registro em integration/rls/cohort-path-admin e contrato `docs/COHORT_PATH.md`
indexado no mapa de docs. Sem mudanca em migrations anteriores, app, fixtures canonicas ou dependencias.

- `admin_cohort_path_get/save`: ADMIN+AAL2, catalogo de metadados, lock da turma, validacao completa,
  substituicao atomica, copia do curso, auditoria e recalculo de conclusao apos editar trilha.
- FOR SHARE nos itens de conteudo protege as referencias contra moves/deletes concorrentes.
- `get_student_learning_path`: aluno/matricula proprios, ordem da trilha, AVAILABLE/LOCKED_DATE/LOCKED_SEQUENCE,
  data efetiva herdada, sem drafts, gabaritos, conteudo ou URLs. Direitos de material preservados.
- Testes incluem falha tardia na auditoria: rollback tambem desfaz conclusao de matricula e seu audit.

| Verificacao                                                                                                                         | Resultado real                                                                                    | Evidencia                  |
| ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------- |
| `psql -X -v ON_ERROR_STOP=1 -1 -f supabase/migrations/20261015130000_stage_12c2_cohort_path_admin.sql`                              | exit 0 (seguido de refinamentos locais)                                                           | replay final abaixo        |
| Replay integral da migration final e teste final num schema sem funcoes C2, dentro de transacao/ROLLBACK                            | exit 0                                                                                            | `c2-replay.log`            |
| `DATABASE_URL=...55422... node scripts/run-sql-tests.mjs cohort-path-admin`                                                         | exit 0                                                                                            | `c2-cohort-path-admin.log` |
| Mesmo runner: cohort-path, practice-authoring, assessment-authoring, access-closure, function-privileges, sensitive-tables-negative | todos exit 0                                                                                      | respectivos `c2-*.log`     |
| psql isolado: cohorts.sql, admin_content.sql, placement.sql, assessment_engine.sql                                                  | todos exit 0                                                                                      | respectivos `c2-*.log`     |
| Concorrencia real com helper withBarrier: duas gravacoes esperam lock da turma; gravacao espera lock do modulo fonte                | exit 0, sem deadlock; todas as gravacoes com ROLLBACK, configuracao e contagem de audit identicas | `c2-save-concurrency.log`  |
| `node node_modules/typescript/bin/tsc --noEmit`                                                                                     | exit 0                                                                                            | `c2-typecheck.log`         |
| `node node_modules/eslint/bin/eslint.js src tests --quiet`                                                                          | exit 0                                                                                            | `c2-eslint.log`            |
| `node node_modules/vitest/vitest.mjs run`                                                                                           | exit 0: 64 arquivos/532 testes passaram, 1 ignorado                                               | `c2-vitest.log`            |
| `node scripts/verify-db.mjs`                                                                                                        | exit 0                                                                                            | `c2-verify-db.log`         |
| `node scripts/verify-security.mjs`                                                                                                  | exit 0                                                                                            | `c2-verify-security.log`   |

A prova de concorrencia usou somente Admin/turma/modulo ja existentes na stack isolada 55422,
com operacoes em transacoes revertidas; nao criou dados permanentes. O helper aguarda os clientes
aparecerem em pg_stat_activity com wait_event_type=Lock antes de soltar a barreira.
O replay removeu somente as cinco funcoes C2 na transacao, reaplicou o arquivo final inteiro e executou
as fixtures/assertions do teste sem BEGIN/ROLLBACK aninhados; ROLLBACK final preservou a stack.

Nao houve reset integral, build, commit ou acesso ao banco de desenvolvimento. A integracao do app segue
nas sessoes 4–6; gates finais e pendencias anteriores do eval/agenda continuam no registro C1.
Etapa 12 permanece in_progress/verified:false. Proximo bloco: E SQL, admin_enroll_in_course.

Fechamento local C2: verify-harness, verify-db e verify-security exit 0; format dos arquivos
JS/Markdown/JSON verificados exit 0 (`c2-format.log`); git diff --check exit 0.
A pasta docs e ignorada pelo Prettier do repositorio, e nao ha formatter SQL configurado;
o contrato novo e a migration tiveram revisao manual e validacao SQL real.
`eval-agent` exit 1 com os mesmos tres achados anteriores (`c2-eval-agent.log`);
nao cobre as alteracoes nao commitadas. Nenhuma alegacao de gate final aprovado.

## E SQL — matricula administrativa (2026-10-15)

Entregues `20261015140000_stage_12e_admin_enroll_next_course.sql`, teste transacional independente
`admin_course_enrollment.sql`, registro em integration/rls/admin-course-enrollment e contrato em
`docs/PLACEMENT.md`. Sem modificacao em migrations anteriores, UI ou banco de desenvolvimento.

- ADMIN+AAL2, alvo STUDENT, curso publicado/ativo e turma compativel ACTIVE, nao encerrada, com capacidade configurada/vaga.
- Usa activate_enrollment, preserva matriculas/memberships anteriores e progresso; destino COMPLETED e rejeitado.
  Reativa CANCELLED com o mesmo enrollment_id e audit existente; reaproveita membership ACTIVE efetiva sem duplicar.
- Recibo imutavel por operation_id, protegido por RLS/sem grants ao cliente. Mesmo id/ator/parametros retorna
  resultado original; conflito falha. Contexto tecnico do retry pode variar sem executar novamente.
- Lock por operation_id e turma; reserva da chave aluno/curso com ON CONFLICT DO NOTHING evita reabrir
  uma linha COMPLETED numa disputa de criacao, sem bloquear a linha Auth do aluno durante progresso.
- Auditoria autenticada, com motivo e contexto. Falha tardia desfaz matricula, membership, recibo,
  reativacao e audits. Nao concede assinatura, cortesia ou entitlement; guard pago permanece ativo.

| Verificacao                                                                                                                                                                 | Resultado real                                                          | Evidencia                          |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------- |
| `psql -X -v ON_ERROR_STOP=1 -1 -f supabase/migrations/20261015140000_stage_12e_admin_enroll_next_course.sql`                                                                | exit 0 (seguido de refinamento local do RPC)                            | replay final abaixo                |
| Replay da migration final inteira a partir do schema sem os objetos E + teste completo, em transacao/ROLLBACK                                                               | exit 0                                                                  | `e-replay.log`                     |
| `DATABASE_URL=...55422... node scripts/run-sql-tests.mjs admin-course-enrollment`                                                                                           | exit 0                                                                  | `e-admin-course-enrollment.log`    |
| Mesmo runner: cohort-path, cohort-path-admin, practice-authoring, access-closure, enrollment-integrity, function-privileges, sensitive-tables-negative, record-immutability | todos exit 0                                                            | respectivos `e-*.log`              |
| psql isolado: cohorts.sql e placement.sql                                                                                                                                   | ambos exit 0                                                            | `e-cohorts.log`, `e-placement.log` |
| Concorrencia real: duas chamadas no lock de operation_id e duas operacoes distintas disputando a mesma chave aluno/curso antes inexistente                                  | exit 0, sem deadlock, todas as transacoes revertidas                    | `e-concurrency.log`                |
| `node node_modules/typescript/bin/tsc --noEmit`                                                                                                                             | exit 0                                                                  | `e-typecheck.log`                  |
| `node node_modules/eslint/bin/eslint.js src tests --quiet`                                                                                                                  | exit 0                                                                  | `e-eslint.log`                     |
| `node node_modules/vitest/vitest.mjs run`                                                                                                                                   | exit 0; 64 arquivos/532 testes passaram, 1 ignorado                     | `e-vitest.log`                     |
| `node scripts/verify-db.mjs`                                                                                                                                                | exit 0                                                                  | `e-verify-db.log`                  |
| `node scripts/verify-security.mjs`                                                                                                                                          | exit 0                                                                  | `e-verify-security.log`            |
| `node scripts/verify-harness.mjs`                                                                                                                                           | exit 0                                                                  | `e-verify-harness.log`             |
| `node scripts/eval-agent.mjs`                                                                                                                                               | exit 1; os mesmos 3 achados anteriores da comparacao origin/main...HEAD | `e-eval-agent.log`                 |

Prova de concorrencia: usou identidades/curso publicados existentes na stack isolada e turmas/settings
criadas dentro de cada transacao, com rollback de tudo. O helper withBarrier confirmou espera em lock
antes de soltar a barreira. Na disputa de criacao, a barreira segurou a linha Auth somente na sessao de teste,
forcando os INSERTs a aguardar o FK/chave unica. O RPC nao toma esse lock de Auth.
Contagens de matriculas, memberships, recibos e audits antes/depois permaneceram identicas.
Como as operacoes concorrentes sao revertidas, a prova de retry com recibo ja gravado e conflito de parametros
esta no teste SQL transacional, que le o recibo da chamada anterior na mesma transacao.

O replay removeu somente os objetos E na transacao, reaplicou a migration final inteira e executou
as fixtures/assertions do teste sem BEGIN/ROLLBACK aninhados; ROLLBACK preservou a stack.
Nao substitui o reset/gates finais da sessao 9. Sem commit, build, instalacoes ou subagentes.
A falha preexistente de agenda e os achados globais do eval permanecem no registro C1; nenhuma regra foi afrouxada.
Etapa 12 continua in_progress/verified:false. Proxima sessao: UI Admin do teste de entrada, audience e LISTENING.

## Fechamento A/B — 2026-10-15

Escopo do pedido «Conclua A e B»: autoria de práticas do professor e autoria Admin do teste de entrada. UI C/E fora desta sessão. Stack exclusiva yastest12: API 55421, Postgres 55422, Next dev isolado 3100. Nenhum commit, build, deploy ou alteração no banco dev.

B: módulos admin-assessments de domínio/UI/servidor e rotas /admin/assessments{,/new,/[id]}; menu; editor de questões, seleção explícita como entrada, versões e aposentadoria. Práticas v2 no editor legado Admin em somente leitura; Listening removido apenas das opções legadas. Prompts publicados precisam satisfazer os schemas canônicos do motor Student. Publicação de nova versão preserva tentativas anteriores; a entrada mantém uma versão publicada. Campos de resposta humana não definem score ou CEFR.

A: construtor/player preexistentes exercitados no navegador. Corrigida preservação do passo Publicar e atribuir após comandos. E2E cobre criar/salvar/prévia/publicar/atribuir/prazo, aluno da turma responder, outra turma não ver, outro professor receber 404 e tentativa exigir duplicação. Matriz completa de formatos e mídia coberta em practice_authoring.sql e unitários de domínio/construtor/player.

| Verificação | Resultado | Evidência |
| --- | --- | --- |
| SQL transacional practice_authoring, assessment_authoring, placement, assessment_engine, function_privileges | todos exit 0, docker exec psql em supabase_db_yastest12 | ab-*.log correspondentes |
| Vitest completo | exit 0, 67 arquivos/544 testes passaram, 1 ignorado | ab-vitest.log |
| Typecheck | exit 0 | ab-typecheck.log |
| ESLint src tests --quiet | exit 0 | ab-eslint.log |
| Prettier arquivos A/B tocados | exit 0 | ab-format.log |
| verify-db/security/harness | todos exit 0 | ab-verify-*.log |
| E2E A/B | exit 0; 2 passaram, 0 skipped/flaky/falhas; gate JSON exit 0 | ab-e2e.log, ab-e2e-results.json |
| A11y Stage 12 desktop/mobile | exit 0; 4 passaram, 0 skipped/flaky/falhas; gate JSON exit 0 | ab-a11y.log, ab-a11y-results.json, ab-a11y-gate.log |

Telas desktop/tablet/mobile: screenshots/a-preview-*.png e screenshots/b-editor-*.png. Inspeção visual feita nos seis arquivos desktop/tablet/mobile: sem corte horizontal; tipografia, controles, estados e navegação seguem os primitivos existentes. Axe WCAG 2 A/AA, 2.1 AA e 2.2 AA nos três viewports faz parte do E2E, sem atualização de goldens.

Ambiente: REST isolado foi recuperado com a imagem local PostgREST, DB/JWT exclusivamente yastest12 e credenciais obtidas do status oficial do CLI sem imprimir segredos. setup-canonical-e2e rodou apenas nessa stack (ab-fixtures.log). MFA usa namespace temporário stage12 para não sobrescrever segredos de outras stacks. Teste B cria Student exclusivo e restaura a flag de entrada original em finally.

O disco ficou sem espaço por cache persistente e processos Next órfãos após interrupções. Removido apenas cache gerado de caminho verificado e desativado cache persistente apenas em YAS_ISOLATED_VERIFY; teste protege configuração isolada e padrão. Rodada final usa servidor controlado e configs temporárias que importam as configurações oficiais, removendo só a gestão automática de webServer e adicionando relatório JSON. Não altera políticas, retries ou assertions. Limpeza dos arquivos temporários ao encerrar.

Limites: verify:ui/full e reset completo continuam reservados ao fechamento macro (handoff sessões 9–10); não executados aqui. Três achados globais conhecidos do eval-agent origin/main...HEAD e agenda/resíduos constam no registro C1. Macro permanece in_progress/verified:false. A/B não representam a conclusão de C/E nem de toda a Etapa 12.

A/B concluídos e comprovados localmente. Relatórios JSON: E2E 2/2 em 144.9s; a11y 4/4 em 53.7s, todos sem retries/skips. Configurações transitórias preservadas em ab-runner-configs.txt e removidas da raiz. Servidor isolado encerrado após validação. Feature macro continua não verificada; gates finais e UI C/E permanecem pendentes.
