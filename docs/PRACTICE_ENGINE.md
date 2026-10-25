# Practice Engine

## Propósito
Fazer a aba Prática responder “o que devo treinar agora?” com atividades curtas, contextualizadas e mensuráveis.

## Decisões
Skills/tipos:
- Speaking
- Listening
- Pronunciation
- Vocabulary
- Grammar

Metadata esperada: skill, CEFR target, difficulty, estimated minutes, related lesson/module e conteúdo/rubric quando aplicável.
Tentativas armazenam aluno, atividade, início/fim, resultado/feedback e metadata necessária.
Na V1, a recomendação é determinística e centralizada no domínio. A ordem prioriza:
1. atividade com resposta determinística antes de estado manual/pendente;
2. vínculo com a aula acessada mais recentemente;
3. atividade menos praticada;
4. menor duração e `slug` como desempates estáveis.

A UI exibe a proveniência da recomendação. CEFR target é somente contexto editorial e não participa como resultado do aluno.

Conteúdo V1 contratado:
- Vocabulary e Grammar: múltipla escolha com gabarito privado e feedback objetivo;
- Speaking e Pronunciation: registro textual com estado `PENDING_MANUAL`, sem score, atrás de `PracticeEvaluationPolicyPort`;
- Listening: `UNSUPPORTED` enquanto não houver asset de áudio contratado.

## Contrato vigente — práticas do professor vinculadas à aula (ADR 0025)

Este contrato substitui as regras históricas das Etapas 12A e 13A para práticas de autoria docente. A especificação técnica atual está em [PRACTICE_V3.md](./PRACTICE_V3.md), e a decisão durável em [ADR 0025](./adr/0025-lesson-bound-practice-final-submission.md).

- Professor com TEACHER + AAL2 e escopo do curso cria práticas em três etapas: informações, questões e revisão/publicação. Rascunhos exigem curso, módulo e aula; conflito de versão não sobrescreve alterações recentes.
- Toda prática publicada precisa de vínculo válido com uma aula. Alunos autorizados a acessar essa aula veem suas práticas publicadas pelas mesmas regras de matrícula, trilha e acesso pago. Atribuição a turma não concede acesso nem ignora a disponibilidade da aula.
- Respostas ficam editáveis como rascunho, sem correção ou pontuação provisória. `practice_submit_final` valida e corrige todos os itens numa transação; tentativas enviadas repetidamente retornam o mesmo resultado. Há uma submissão final por aluno/prática.
- Questões objetivas usam pontos ponderados (`weight`, padrão 1); WRITTEN/SPOKEN permanecem pendentes de revisão humana e não recebem score automático. `firstTryCorrect` conta questões, não pontos ponderados. Prática não altera proficiência CEFR.
- Não há nova rodada de reforço ou revisão espaçada para esse fluxo. Tentativas, resultados e schedules históricos são preservados.

Persistência usa `PracticeActivity → PracticeAttempt → PracticeResponse → PracticeResult`. Início e submissão são idempotentes e o banco deriva `auth.uid()`; o browser nunca envia `user_id` como autoridade.

UX planejada:
- Prática de hoje como ação dominante;
- escolha por habilidade;
- revisão relacionada ao curso;
- desafios rápidos;
- histórico recente;
- desempenho semanal secundário.

## Invariantes
- Prática não duplica Aulas.
- Resultado de prática não vira automaticamente nível CEFR.
- Resultado/progresso de prática não escreve em `lesson_progress`, `assessment_attempts` ou `skill_scores`.
- Recomendação possui sinais/provenance explicáveis.
- Duração curta e próxima ação clara são prioridades.

## O que não fazer
- Biblioteca infinita sem recomendação.
- Score artificial de pronúncia sem sistema confiável.
- Misturar encontro ao vivo com practice activity.
- Copiar módulos de Aulas para a aba Prática.

## Interfaces
[PRODUCT.md](./PRODUCT.md) · [CEFR_ASSESSMENT.md](./CEFR_ASSESSMENT.md) · [DATA_MODEL.md](./DATA_MODEL.md) · [ANALYTICS.md](./ANALYTICS.md)

## Critérios de aceitação
- O aluno inicia prática relevante em poucos passos.
- Activity/attempt/result permanecem distinguíveis.
- Resposta e resultado permanecem distinguíveis; somente tentativas do próprio aluno são visíveis para ele.
- Recomendações não falsificam proficiência.

## Etapa 11 — escopo por matrícula (ADR 0017)

- A Prática não é um catálogo livre. O aluno vê e inicia apenas atividades do curso em que tem matrícula `ACTIVE`/`COMPLETED` (via `related_module_id`/`related_lesson_id`). Atividades sem vínculo exigem qualquer matrícula `ACTIVE`/`COMPLETED`.
- O gate de pagamento (trigger em `practice_attempts`) continua valendo; o histórico de tentativas permanece legível para o aluno suspenso.
- Sem matrícula, `/pratica` mostra um estado vazio orientando concluir a entrada no Yas.

## Histórico — Etapa 12A (ADR 0020, decisões supersedidas em 2026-10-22)

Na versão histórica, o professor com AAL2 configurava a prática em seis passos e a atribuía a uma ou mais turmas próprias. Esse fluxo foi substituído pela autoria em três etapas e pelo acesso derivado da aula; atribuições antigas permanecem nos dados, mas não concedem acesso. Outro professor não edita a autoria alheia e práticas com tentativas continuam exigindo duplicação para edição.

O formato v2 combina estímulo NONE/TEXT/IMAGE/AUDIO/VIDEO com resposta CHOICE_SINGLE/CHOICE_MULTI/TRUE_FALSE/CLOZE/ORDERING/WRITTEN/SPOKEN. Os cinco formatos objetivos são corrigidos no banco com gabarito privado. WRITTEN e SPOKEN seguem para revisão humana, sem score ou max_score. Listening v2 possui suporte; a limitação UNSUPPORTED descrita acima refere-se ao formato legado.

Uploads de imagem, áudio e vídeo usam armazenamento privado e autorização por prática antes da emissão de URL assinada. Vídeo de prática usa arquivo protegido sem transcodificação (ADR 0020). O fluxo Mux das aulas permanece separado. Pré-visualização do professor não cria tentativa nem resultado.

Naquela versão, o aluno via práticas atribuídas à turma em /pratica. A persistência e as regras de conteúdo v2 descritas acima continuam relevantes para compatibilidade; a visibilidade atual segue o contrato vigente por aula.

## Histórico — Etapa 13A (ciclo de vida v3 anterior, supersedido em 2026-10-22)

- A regra anterior retomava tentativas abertas em até 24 horas, abandonava tentativas mais antigas, e permitia que atribuições de turma ignorassem a disponibilidade da aula. O contrato atual mantém respostas provisórias retomáveis, sem consumir a submissão final antes do envio; nenhuma atribuição ignora a autorização da aula.
- Os detalhes de `student_practice_reach()` ainda podem ser usados por outras superfícies existentes, mas a política vigente de prática docente não permite o bypass por turma. Dados históricos de tentativa/schedule permanecem preservados.

## Assignment release (2026-10-21)

cohort_practice_assignments.available_from is an optional start instant; due_at remains a separate deadline and never grants early access. require_lesson_available defaults false to preserve existing teacher assignments. Opting in requires related_lesson_id and enforces that lesson publication, cohort inclusion, release date and sequence permit access. The practice/course must still pass existing publication, enrollment, payment and entitlement gates.

The existing teacher_practice_assign signature gains optional parameters p_available_from and p_require_lesson_available after p_context; no overload is retained. One assignment per practice/cohort remains authoritative; reassigning selected cohorts updates only their scheduling rule. student_path_available centralizes the release predicate used by activity RLS, start RPCs, recommendations and private asset authorization. DB triggers validate course/lesson/assignment coherence and protect referenced ancestry from being moved.

Legacy COURSE assignments used solely to signal lesson reach remain supported with their inferred course scope. They cannot accept the new scheduling fields; scheduled authoring stays on ASSIGNED practices, whose per-cohort release predicate is authoritative.

Private practice stimulus assets also repeat has_paid_access for Students after release; author/Admin preview behavior and attempt history reads are preserved.
