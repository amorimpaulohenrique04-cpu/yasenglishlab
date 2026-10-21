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

## Etapa 12A — autoria do professor (content v2)

Professor com AAL2 cria em /teacher/praticas um rascunho no seu escopo de curso, configura em seis passos, testa no mesmo player do aluno, publica diretamente e atribui a uma ou mais turmas próprias, com prazo opcional. A atribuição é por turma. Outro professor não edita a autoria alheia. Práticas com tentativas exigem duplicação para edição.

O formato v2 combina estímulo NONE/TEXT/IMAGE/AUDIO/VIDEO com resposta CHOICE_SINGLE/CHOICE_MULTI/TRUE_FALSE/CLOZE/ORDERING/WRITTEN/SPOKEN. Os cinco formatos objetivos são corrigidos no banco com gabarito privado. WRITTEN e SPOKEN seguem para revisão humana, sem score ou max_score. Listening v2 possui suporte; a limitação UNSUPPORTED descrita acima refere-se ao formato legado.

Uploads de imagem, áudio e vídeo usam armazenamento privado e autorização por prática antes da emissão de URL assinada. Vídeo de prática usa arquivo protegido sem transcodificação (ADR 0020). O fluxo Mux das aulas permanece separado. Pré-visualização do professor não cria tentativa nem resultado.

O aluno vê as práticas atribuídas à sua turma em /pratica; prazo, matrícula, entitlement e escopo continuam aplicados no servidor/banco. Revisão humana e desempenho de prática não alteram progresso de curso nem proficiência CEFR.

## Etapa 13A — ciclo de vida da tentativa e alcance por aula (practice-10-phase-0)

- Iniciar uma prática retoma a tentativa `IN_PROGRESS` do mesmo aluno e atividade quando houve atividade nas últimas 24h; uma tentativa aberta mais antiga vira `ABANDONED` no próximo início (sem rotina agendada). Um índice único parcial impede duas tentativas abertas para o mesmo (aluno, atividade, tipo).
- O aluno só inicia práticas de aulas alcançadas: aula concluída, aula iniciada, a aula atual da trilha (primeira não concluída e disponível) ou prática sem vínculo de aula. Prática atribuída pelo professor à turma do aluno ignora esse bloqueio. O banco aplica a regra em `start_practice_attempt` e a expõe em `student_practice_reach()`; a UI só a espelha.
- Aulas não alcançadas aparecem na Prática como bloqueadas, sem ação de início, e nunca como destaque. A recomendação considera apenas atividades alcançadas.
- O resumo semanal mostra minutos **estimados** (soma do tempo previsto das atividades enviadas nos últimos 7 dias, por consulta própria) e atividades enviadas; não é tempo medido.

## Assignment release (2026-10-21)

cohort_practice_assignments.available_from is an optional start instant; due_at remains a separate deadline and never grants early access. require_lesson_available defaults false to preserve existing teacher assignments. Opting in requires related_lesson_id and enforces that lesson publication, cohort inclusion, release date and sequence permit access. The practice/course must still pass existing publication, enrollment, payment and entitlement gates.

The existing teacher_practice_assign signature gains optional parameters p_available_from and p_require_lesson_available after p_context; no overload is retained. One assignment per practice/cohort remains authoritative; reassigning selected cohorts updates only their scheduling rule. student_path_available centralizes the release predicate used by activity RLS, start RPCs, recommendations and private asset authorization. DB triggers validate course/lesson/assignment coherence and protect referenced ancestry from being moved.

Legacy COURSE assignments used solely to signal lesson reach remain supported with their inferred course scope. They cannot accept the new scheduling fields; scheduled authoring stays on ASSIGNED practices, whose per-cohort release predicate is authoritative.

Private practice stimulus assets also repeat has_paid_access for Students after release; author/Admin preview behavior and attempt history reads are preserved.
