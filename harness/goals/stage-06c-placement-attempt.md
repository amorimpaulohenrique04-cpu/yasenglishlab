# Etapa 06c - tentativa de avaliação ligada ao caso de Placement

- Problema: `start_placement_assessment()` reaproveitava qualquer tentativa do aluno (outra origem, versão despublicada) como evidência.
- Correção: migration aditiva `20261013190000_stage_06c_placement_attempt_link.sql`; reaproveita só tentativa com `idempotency_key` = id do caso (chave usada por `start_assessment_attempt(v, case_id)`).
- Fora de escopo: reaplicação do teste e pontuação manual (OPEN_QUESTIONS).
- Teste: `supabase/tests/placement_attempt_link.sql` (suites `integration` e `placement-attempt-link`).
- Verificação real: job Database do CI (sem docker local).
