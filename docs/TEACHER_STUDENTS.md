# Alunos do professor

A listagem em `/teacher/alunos` e o perfil em `/teacher/alunos/[studentId]` permitem acompanhamento pedagógico de alunos com vínculo vigente. Não são diretório administrativo nem ferramenta de matrícula.

## Autorização e projeções

`teacher_students_workspace`, `teacher_students_events` e `teacher_student_workspace` exigem professor ativo + TEACHER/AAL2, derivado da sessão por `private.current_teacher_id()`. A lista usa vínculos `teacher_student_assignments` vigentes; o detalhe valida `private.is_teacher_assigned`. Conhecer o UUID não concede acesso. Um aluno aparece uma vez mesmo com vários vínculos ou matrículas.

São leituras com escopo explícito, `search_path=''` e EXECUTE apenas a `authenticated`. Helpers privados não são executáveis por `public`, `anon` ou `authenticated`. Não há leitura de e-mails de `auth.users`, mudança de RLS ou gravação durante consultas. Sessões, presença e tarefas incluem apenas sessões próprias do professor e reservas do aluno. Notas são filtradas pelo professor autor.

O workspace não usa os limites de 200 alunos / 100 sessões do contexto legado. Agrega a carteira inteira e pagina a listagem em oito itens; históricos em dez. Filtros, ordenação, visualização e página permanecem na URL. O retorno do perfil aceita apenas uma URL de listagem local reconstruída a partir dos filtros conhecidos.

## Indicadores

- Alunos acompanhados: alunos distintos com vínculo vigente.
- Atenção: inatividade ou pedido de novo teste aberto. As revisões pendentes são responsabilidade operacional do professor e não são um diagnóstico do aluno.
- Revisões: tentativas de prática elegíveis ao mesmo fluxo de revisão canônico, contadas uma vez mesmo com vários itens, mais processos de Entrada em REVIEW_PENDING sem revisão finalizada. Não há limite de fila na agregação.
- Progresso médio: média das matrículas ACTIVE com ao menos uma aula publicada aplicável. Matrículas sem denominador ficam fora da média e são apresentadas sem valor disponível.
- Indicadores e distribuição se referem à carteira inteira, independentemente da busca ou página. Contagens das abas respeitam busca/filtros e antecedem o filtro da própria aba.

O progresso por matrícula usa a média do completion_percent das aulas publicadas da trilha, com zero para aulas sem registro e o predicado canônico `student_path_includes`. Não usa média de uma amostra de lesson_progress nem mistura porcentagem de curso com CEFR. Sem trilha aplicável, o valor é nulo. A classificação CEFR não é inferida de curso, turma ou percentual.

A distribuição é por curso principal, uma participação por aluno: matrícula ativa mais recente, senão concluída mais recente, senão Sem matrícula. Na tabela, filtros de curso/turma/situação selecionam o contexto correspondente. Matrículas encerradas permanecem consultáveis no perfil e em seu filtro explícito.

## Três dimensões do aluno

Estados distintos, nunca fundidos em um único rótulo:

- Administrativa: matrícula (ACTIVE/COMPLETED/CANCELLED/sem matrícula), turma e `placement_state` (estado do caso de Entrada mais recente, ou nulo). É situação de cadastro e fluxo de Entrada, não desempenho.
- Engajamento: atividade de aprendizagem e inatividade (sete dias, abaixo). No perfil, `engagement` traz `learningLast7` (eventos de aprendizagem em [agora-7d, agora)), `learningPrev7` ([agora-14d, agora-7d)) e `lastRelevantEvent` (último evento relevante ou nulo).
- Pendência pedagógica: revisões de Entrada e de prática aguardando o professor, e pedido de novo teste aberto.

## Próximas ações

`actions` (máx. 8) e `actionsTotal` são calculados sobre a carteira inteira do professor, independentemente de página, aba, busca ou filtros, e só com alunos de vínculo vigente. Tipos (`kind`):

1. `entry_review`: teste de entrada em REVIEW_PENDING sem revisão finalizada. `waitingSince` = `placement_cases.state_changed_at` (entrada em revisão, mesma convenção do SLA de 24h de `teacher_entry_queue`); `overdue` = true após 24h; `targetId` = id do caso.
2. `practice_review`: tentativas de prática pendentes de revisão manual, agrupadas por aluno (`count`); `waitingSince` = envio mais antigo; `targetId` = tentativa pendente mais antiga.
3. `reassessment`: pedido de novo teste aberto; `waitingSince` = data do pedido; `targetId` nulo.
4. `inactive`: aluno inativo há sete dias ou mais; `waitingSince` = referência de inatividade; `targetId` nulo.

Um aluno pode gerar mais de um item (ex.: Entrada + prática). Ordem: Entrada atrasada primeiro; depois Entrada e prática por `waitingSince` crescente; depois pedidos de novo teste por data crescente; por fim inatividade por dias de inatividade decrescentes. Itens além de oito ficam fora de `actions`, mas contam em `actionsTotal`.

## Aba "Com pendências"

`tab=pending` lista alunos com `practice_pending + entry_pending > 0` e `counts.pending` os conta (respeitando busca/filtros, como as demais abas). Não altera "Precisam de atenção", que segue sendo inatividade ou pedido de novo teste aberto.

## Feed de atividades

O feed recente da listagem (5 itens) mostra apenas eventos relevantes (`relevant`): aula concluída, prática enviada, avaliação enviada, presença em sessão e falta registrada. Aula acessada, prática/avaliação iniciada e reserva não entram. Avaliações do teste de entrada têm `detail` = "Teste de entrada". O perfil e "ver todas" mantêm todos os tipos e expõem `relevant`.

## Atenção após sete dias

Aplica-se apenas quando existe matrícula ACTIVE. A referência é a maior data entre o início do vínculo vigente e a última atividade de aprendizagem visível. Aos sete dias completos, o aluno entra no filtro de inatividade. Sem registros, há sete dias de tolerância desde o vínculo; matrículas concluídas e alunos apenas em Entrada não recebem esse alerta temporal.

Sinais de aprendizagem: acesso registrado a aula; início/envio de prática; início/envio de avaliação válida; presença ATTENDED numa sessão própria, usando a data real da sessão. Login, reserva, falta, nota, pontuação/revisão do professor e pedido de novo teste não reiniciam a contagem. O histórico de aulas mostra o último acesso/conclusão persistido por aula, não promete todos os acessos anteriores. Datas em America/Recife (GMT−3).

## Perfil e comandos

Abas: Resumo, Atividades, Avaliações e Notas internas. As atividades e as reservas/tarefas são paginadas em paralelo na aba Atividades. Avaliações reúne tentativas enviadas/pontuadas e pedidos de novo teste, com histórico de Entrada separado. Somente nomes/rótulos públicos, notas próprias e evidências autorizadas são retornados; não se retornam answer keys ou rubricas privadas.

Notas continuam usando `create_teacher_note` (1–4.000 caracteres) e pedidos usam `request_reassessment` (10–1.000). O segundo preserva a unicidade do pedido aberto. Um pedido não inicia teste, não altera matrícula e não substitui resultados anteriores. Os formulários preservam o texto em falhas, bloqueiam envio simultâneo e revalidam a listagem e o perfil após sucesso. Não há edição/exclusão de notas, comunicação externa, ações em lote ou alteração da experiência do aluno.

## Verificação inicial

Por decisão do usuário, sem gates, build ou suites amplas. Evidências em `harness/evidence/teacher-students-redesign/`; testes focados em `tests/unit/student-workspace.test.ts` e `supabase/tests/teacher_students_workspace.sql`. Certificação oficial pendente, `verified:false`.
