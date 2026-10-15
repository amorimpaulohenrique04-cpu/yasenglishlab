# ADR 0023 — Matrícula administrativa no próximo curso e direitos de plano editáveis

## Status

accepted

## Date

2026-10-15

## Context

A única entrada em um novo curso era o placement, e concluir um curso (ADR 0018) não levava a nada. Direitos de plano só mudavam por migration.

## Decision

1. **Próximo curso.** `admin_enroll_in_course` (ADMIN + AAL2) matricula o aluno em curso ativo e publicado, em turma ativa com vaga, usando `private.activate_enrollment`. A matrícula concluída não é encerrada: `COMPLETED` e `ACTIVE` coexistem. Idempotente por `operation_id`; o mesmo id com parâmetros diferentes falha. Auditado. O aluno que concluiu vê o aviso de que a equipe indicará o próximo passo.
2. **Direitos de plano.** `admin_plan_set_entitlement` (ADMIN + AAL2) fecha a linha vigente e insere a nova, com vigência futura, sem tocar nas reservas já feitas (que guardam o direito usado). Idempotente quando igual. Auditado.
3. **Preço fora de escopo.** Reajuste continua decisão separada de `docs/BILLING.md`.
4. **Alertas operacionais.** `admin_operational_alerts` devolve em uma chamada as lacunas silenciosas: turma sem configuração de entrada, caso sem turma elegível e a causa, revisão ou escolha parada, teste de entrada não publicado e curso concluído sem próxima matrícula.

## Alternatives

- Matrícula automática no próximo nível: rejeitada; o product owner prefere decisão do Admin.
- Editar preço junto com direitos: rejeitado, escopo diferente.

## Consequences

- Reset local com `seed.sql` (`on conflict do update`) desfaz edições de direitos; fica documentado em `docs/BILLING.md`.
