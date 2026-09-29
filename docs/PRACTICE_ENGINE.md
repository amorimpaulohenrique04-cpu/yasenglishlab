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
Recomendação ideal usa sinais como aula recente, skill, nível e necessidade observada.

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
- Recomendações não falsificam proficiência.
