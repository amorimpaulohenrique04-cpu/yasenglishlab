# ADR 0015 — Subscription lifecycle and learning access

## Status

accepted (decision 1 superseded by [ADR 0016](./0016-access-suspension-on-payment-failure.md))

## Date

2026-10-12

## Context

O diagnóstico de 2026-10-12 mostrou que o estado da assinatura só bloqueia novas reservas ao vivo: reembolso, chargeback e encerramento não alteram matrícula, coorte nem conteúdo; não existe cancelamento pelo usuário; a transferência de coorte entre cursos deixa a matrícula anterior ativa; e `record_lesson_progress` não exige coorte ativa. O comportamento era implícito, não decidido.

## Decision

1. **Acesso por estado da assinatura.** `EXPIRED`, `CANCELLED` e reembolso encerram o acesso a conteúdo e às reservas futuras. `PAST_DUE` mantém o conteúdo e bloqueia apenas novas reservas. A revogação ocorre por função transacional aditiva sobre `enrollments`, `cohort_memberships` e reservas futuras, sem apagar histórico nem progresso.
2. **Cancelamento pelo usuário.** O aluno cancela pelo produto via API do Asaas, registrando `cancel_at_period_end`; o evento de webhook continua sendo a confirmação de estado. Upgrade e downgrade ficam fora do escopo e devem ser documentados como tal.
3. **Transferência de coorte entre cursos.** `transfer_placement_cohort` encerra a matrícula do curso anterior na mesma transação em que cria a nova membership.
4. **Aluno sem coorte ativa.** Não grava progresso de aulas. Alunos legados exigem backfill ou bloqueio explícito.
5. **Cancelamento do professor.** `cancel_teacher_live_session` atua apenas sobre reservas `BOOKED` de sessões `SCHEDULED`; reservas já canceladas, inclusive cancelamentos tardios do aluno que consomem cota (ADR 0008), não são reescritas.

## Alternatives

Manter o comportamento atual (só bloquear reservas) foi rejeitado: aluno reembolsado manteria vaga e conteúdo. Cancelamento exclusivo pelo painel do Asaas foi rejeitado por exigir ação fora do produto.

## Consequences

Exige migrations aditivas, testes SQL com caso negativo e revisão humana (billing, RLS, dados de matrícula). A janela de tolerância de `PAST_DUE` e o tratamento de reservas já feitas na revogação devem ser fechados na implementação e, se mudarem estas regras, em ADR novo. Esta decisão fecha parcialmente `docs/OPEN_QUESTIONS.md`; não há pergunta correspondente a remover.
