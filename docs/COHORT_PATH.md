# Trilha da turma — contrato SQL (Etapa 12 C1/C2)

Decisao: [ADR 0022](./adr/0022-cohort-learning-path.md). Migrations C1 e C2 em `supabase/migrations/2026101512*` e `2026101513*`.
Os RPCs estao implementados; as telas Admin e a integracao do repositorio Learning seguem nas sessoes posteriores.

## Configuracao e autorizacao

`cohort_paths` guarda mode DEFAULT/CUSTOM e sequential. `cohort_path_items` guarda content_kind,
content_id, position e available_from. Nao ha leitura ou DML direto para anon/authenticated;
todos os RPCs administrativos exigem ADMIN+AAL2 dentro do banco.

- DEFAULT acompanha a ordem natural de modulos/aulas do curso, inclui audience COURSE e permite
  overrides de data e inclusao explicita de itens COHORTS. Um pai exclusivo precisa ser incluido;
  seus filhos COURSE passam a seguir o padrao. Itens COHORTS filhos precisam de inclusao propria.
- CUSTOM inclui exatamente os itens explicitados, na ordem `position`.
- Itens de uma turma devem pertencer ao seu curso e incluir seus pais na mesma lista.
  Um item pode integrar varias turmas. Praticas ASSIGNED continuam no fluxo de atribuicao do professor,
  sem misturar atribuicoes com o editor de trilha.
- Datas dos pais se aplicam aos filhos; a data efetiva e a maior entre o item e seus ancestrais.
  Sequencia exige conclusao das aulas anteriores incluidas, na ordem da turma (CUSTOM) ou curso (DEFAULT).

## RPCs administrativos

`admin_cohort_path_get(p_cohort_id uuid) -> jsonb`

Retorna cohortId, courseId, cohortName, mode, sequential, updatedAt, items e catalog.
Sem configuracao persistida, retorna DEFAULT, sequential=false, updatedAt=null e items=[].
O catalog traz apenas metadados do curso, incluindo drafts: contentKind, contentId, title, audience,
parentKind, parentId, publicationStatus, coursePosition, defaultIncluded. Nao traz gabaritos ou assets.

`admin_cohort_path_save(p_cohort_id uuid, p_mode text, p_sequential boolean, p_items jsonb = [],
p_copy_from_course boolean = false, p_context jsonb = {}) -> jsonb`

Cada item tem esta forma, com UUID canonico e position inteiro nao negativo:

```json
{
  "contentKind": "lessons",
  "contentId": "42000000-0000-4000-8000-000000000001",
  "position": 1,
  "availableFrom": null
}
```

contentKind aceita modules, lessons, materials e practice_activities. availableFrom e opcional,
nulo ou uma data/hora finita; a aplicacao deve enviar ISO 8601 com timezone.
Campos desconhecidos, duplicatas de identidade/posicao, pais ausentes e itens de outro curso sao rejeitados.
Limite de 2000 itens por save, inclusive na copia.

Para copiar o curso, usar CUSTOM, p_items=[] e p_copy_from_course=true. A copia inclui somente
itens COURSE publicados/ativos cujos ancestrais tambem fazem parte do curso padrao; exclui exclusivos,
drafts e ASSIGNED. A lista resultante e independente: publicacoes futuras nao sao inseridas automaticamente.

O save bloqueia a linha da turma com FOR UPDATE, valida a substituicao inteira e troca a lista atomicamente.
Linhas dos itens de conteudo recebem FOR SHARE durante a validacao, protegendo as referencias
polimorficas contra movimentacao ou exclusao concorrente ate o commit.
Turma inexistente retorna P0002; turma ARCHIVED permite consulta, mas rejeita save. A resposta tem o mesmo
contrato do get. Saves concorrentes da mesma turma sao serializados; nao ha controle de versao otimista.

Auditoria `cohort_path_saved` guarda ator autenticado, antes/depois (sem catalog) e copiedFromCourse.
p_context aceita request_id, environment e version como contexto; nao define o ator da operacao.
Qualquer falha, inclusive de auditoria, desfaz lista, configuracao e conclusoes feitas na mesma chamada.

Salvar uma trilha menor reavalia matriculas ACTIVE dos membros atuais usando
`private.complete_path_enrollment`. Uma matricula COMPLETED nunca e reaberta por alterar/publicar conteudo.
Progresso existente e preservado; apenas as aulas publicadas incluidas entram na conclusao automatica.

## RPC do aluno

`get_student_learning_path(p_course_id uuid) -> jsonb`

Exige STUDENT e matricula propria ACTIVE/COMPLETED num curso publicado e ativo; nao aceita user_id externo.
Retorna courseId, slug, title, description, enrollmentId, enrollmentStatus, completedAt, paths e items.

paths lista as memberships efetivas com cohortId, mode e sequential. Sem membership efetiva,
ha um DEFAULT implicito com cohortId=null, que inclui somente COURSE e nao libera o guard de progresso.
Se houver mais de uma membership efetiva, itens sao unidos e deduplicados por tipo/id, com ordenacao
deterministica pela menor posicao e desempate por tipo/id. pathPositions preserva posicao e data por turma.

items e uma lista plana com contentKind, contentId, title, slug, description, estimatedMinutes,
parentKind, parentId, position, availableFrom, pathPositions e state. Campos nao aplicaveis sao nulos.
O consumidor pode agrupar modulos/aulas por parentId e manter a ordem devolvida.

- AVAILABLE: o predicado de disponibilidade da trilha permite o item.
- LOCKED_DATE: a data efetiva ainda esta no futuro; availableFrom informa a liberacao.
- LOCKED_SEQUENCE: datas ja permitem o item, mas uma aula anterior ainda precisa ser concluida.

Datas herdadas explicam tambem o bloqueio de materiais/praticas ligados a uma aula.
Itens nao publicados e fora da trilha nao sao devolvidos. Materiais preservam os guards de acesso pago
e required_entitlement_key mesmo para seus metadados. O RPC nao devolve conteudo, respostas/gabaritos,
paths de Storage ou URLs; os leitores de assets continuam aplicando publicacao, pagamento e entitlements.
AVAILABLE descreve apenas a trilha, nao concede acesso a um asset pago.

## Verificacao

`supabase/tests/cohort_path.sql` cobre o modelo e os leitores C1.
`supabase/tests/cohort_path_admin.sql` cobre RPCs, ADMIN/AAL2, isolamento por turma/curso,
atomicidade inclusive em falha tardia, ordem, datas herdadas, sequencia, copia e conclusao apos save.
Ambos sao transacionais e registrados nas suites integration/rls e aliases cohort-path/cohort-path-admin.
Evidencia local: `harness/evidence/stage-12-lacunas-operacionais/README.md`.
