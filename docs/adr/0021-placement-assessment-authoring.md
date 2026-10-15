# ADR 0021 — Autoria do teste de entrada e avaliação de entrada explícita

## Status

accepted

## Date

2026-10-15

## Context

Não existia editor nem RPC para criar avaliações; só scripts de teste as criavam. `start_placement_assessment` escolhia qualquer versão publicada de qualquer avaliação ativa, então publicar uma segunda avaliação alterava silenciosamente o teste de entrada. Sem avaliação publicada, o onboarding travava.

## Decision

1. **Quem publica:** somente ADMIN + AAL2, coerente com o ADR 0006. Fecha a pergunta de `OPEN_QUESTIONS.md` sobre quem publica e edita avaliações.
2. **Avaliação de entrada explícita:** `assessments.is_placement` com índice único parcial (uma avaliação de entrada ativa). `start_placement_assessment` usa somente ela. O backfill marca a avaliação que a regra antiga já selecionava, preservando o comportamento.
3. **RPCs administrativas** (`admin_assessment_list/get/save_draft/publish/new_version/retire`): leem `answer_key` e `rubric` (que o PostgREST não expõe), gravam assessment, versão e itens de forma atômica e auditam a publicação.
4. **Publicar valida o mesmo contrato** que `start_assessment_attempt` exige; nunca se publica algo que o aluno não conseguirá iniciar.
5. **Imutabilidade pós-publicação** continua garantida pelos triggers existentes; editar = nova versão em rascunho.
6. **Não se aposenta a única versão publicada** da avaliação de entrada.

## Alternatives

- Manter a escolha implícita por data de publicação: rejeitado, não é auditável.
- Um teste por curso: rejeitado pelo product owner; um para todos, escolhido explicitamente.

## Consequences

- Fixtures e testes SQL de placement passam a marcar a avaliação de entrada.
- O alerta operacional de "teste de entrada não publicado" depende desta flag.
