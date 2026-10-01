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

## Assessment Engine V1

O P19 executa somente semântica de avaliação explicitamente contratada. `MULTIPLE_CHOICE` usa resposta de opção única e score binário determinístico (0/1). `MANUAL_TEXT` registra a resposta e permanece pendente; Speaking e Pronunciation não recebem score automático no V1.

`SkillScore` guarda apenas métricas objetivas por habilidade com provenance do engine/fórmula/itens. `assessment_attempts.result_cefr` e `skill_scores.cefr_level` permanecem `NULL`, inclusive para score objetivo perfeito ou item com `cefr_target`. Nenhuma porcentagem é convertida em A1–C2.

O Student recebe somente os campos públicos necessários para executar a versão publicada. `answer_key`, `rubric` e `scoring_config` ficam fora do acesso autenticado normal e são usados apenas no boundary server/database.

P19 não cria UI de Progresso nem Assessment Authoring. Standard setting, reaplicação e o modelo futuro de avaliação de Speaking/Pronunciation continuam em `OPEN_QUESTIONS.md`.
