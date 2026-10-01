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
