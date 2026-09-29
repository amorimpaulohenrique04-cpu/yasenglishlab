# CEFR & Proficiency Assessment

## Propósito
Tratar a avaliação de proficiência como produto próprio, separado de progresso curricular e quizzes de aula.

## Decisões
Competências planejadas:
- Reading
- Listening
- Speaking
- Vocabulary
- Grammar
- Pronunciation

Estrutura conceitual:
`Assessment → AssessmentVersion → Items → Attempt → Responses → SkillScores → ResultLevel`.

Itens carregam, quando aplicável: skill, CEFR target, dificuldade, tipo, resposta/rubric, versão e status.
Teste aplicado permanece auditável; uma revisão gera nova versão.
O gráfico CEFR vem de avaliações, nunca do percentual do curso.

## Invariantes
- Percentual bruto de acertos não é automaticamente A1/A2/B1/B2/C1/C2.
- Relação com CEFR exige specification, revisão, pilotagem/validação e evidência.
- Speaking/pronunciation exigem rubrics e confiabilidade compatíveis com a promessa do produto.
- Curso concluído não equivale a proficiência adquirida.
- Histórico preserva versão e resultado.

## O que não fazer
- “70% = B1” sem modelo validado.
- Alterar cut score histórico sem preservar interpretação/versão.
- Tratar score de IA como verdade pedagógica sem validação.
- Misturar quiz de módulo com teste de proficiência.

## Interfaces
[PRODUCT.md](./PRODUCT.md) · [DATA_MODEL.md](./DATA_MODEL.md) · [ARCHITECTURE.md](./ARCHITECTURE.md) · [PRACTICE_ENGINE.md](./PRACTICE_ENGINE.md)

## Critérios de aceitação
- Resultado identifica versão.
- Skill scores e nível possuem provenance.
- Política de reaplicação é definida antes de produção; ver OPEN_QUESTIONS.
