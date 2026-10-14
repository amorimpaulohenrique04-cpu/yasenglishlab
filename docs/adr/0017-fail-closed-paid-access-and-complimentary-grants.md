# ADR 0017 — Fail-closed paid access and complimentary grants

## Status

accepted (supersedes decision 5 of ADR 0016; complements decision 4 of ADR 0015)

## Date

2026-10-13

## Context

ADR 0016 isentou do gate os "usuários sem nenhuma assinatura (seed/legado)". O gate SQL (`private.has_paid_access`) não distingue um aluno legado de um cadastro novo que ainda não pagou: todo cadastro recebe o papel STUDENT, e a ausência de linha em `subscriptions` liberava o acesso. Como a Prática não exigia matrícula, qualquer conta nova usava a Prática inteira sem pagar. A auditoria de 2026-10-13 também mostrou que uma assinatura `ACTIVE` com cancelamento agendado continuava liberando acesso para sempre se o webhook `SUBSCRIPTION_DELETED` do Asaas nunca chegasse.

## Decision

1. **Fail-closed.** Para um aluno, acesso a conteúdo e a escrita de aprendizagem exigem uma das condições abaixo; a ausência de assinatura não libera mais nada:
   - assinatura `ACTIVE`/`TRIALING`, exceto quando `cancel_at_period_end` é verdadeiro e `current_period_end <= now()`;
   - assinatura `CANCELLED` com `current_period_end > now()` (ADR 0015/0016, etapa 4d);
   - concessão explícita ativa em `public.complimentary_access_grants`.
   Staff continua governado por papel, nunca por assinatura.
2. **Concessão explícita.** Acesso sem assinatura (cortesia, bolsa, legado) existe só como linha em `complimentary_access_grants`, criada ou revogada pelas RPCs `grant_complimentary_access` / `revoke_complimentary_access` (ADMIN + AAL2, auditadas). A concessão pode ter `expires_at`. Ela libera apenas o acesso base: conteúdo e encontros sem `required_entitlement_key` ficam acessíveis, mas entitlements de plano (conteúdo ou sessões com `required_entitlement_key`, cotas de reserva) continuam vindo exclusivamente da assinatura.
3. **Backfill determinístico do legado.** A migração `20261014120000_stage_11_access_closure.sql` concede `LEGACY_BACKFILL` a todo STUDENT sem nenhuma assinatura que tenha matrícula `ACTIVE`, preservando exatamente quem tinha acesso. Cadastros sem matrícula não recebem concessão.
4. **Prática por matrícula.** Ver e iniciar uma atividade de Prática exige matrícula `ACTIVE` ou `COMPLETED` no curso da atividade (ou em qualquer curso, se a atividade não tiver vínculo). O gate de pagamento continua no trigger existente; o histórico permanece legível para o aluno suspenso.
5. **Placement.** `confirm_placement_choice` usa o mesmo predicado `has_paid_access`; um aluno `CANCELLED` com período pago futuro pode confirmar a turma.
6. A camada TypeScript (`deriveSubscriptionAccess`) espelha esta regra apenas para explicar a negação; o banco continua sendo o ponto de enforcement.

## Alternatives

- Manter "sem assinatura = liberado" e confiar só na matrícula: rejeitado, porque a Prática e futuras superfícies sem matrícula ficariam abertas e o furo voltaria a cada nova feature.
- Coluna `is_legacy` em `profiles`: rejeitado; não registra quem concedeu, quando, por quê nem até quando, e não tem trilha de auditoria.
- Job que reconcilia assinaturas com o Asaas para resolver o webhook perdido: útil, mas não substitui a regra local; continua como melhoria futura.

## Consequences

- Toda fixture de teste com aluno matriculado precisa de assinatura ou concessão explícita.
- O Admin ganha um bloco "Acesso concedido" no detalhe do aluno.
- Concessões não dão entitlements; se cortesia precisar de conteúdo ou sessões que exigem entitlement, a decisão está em OPEN_QUESTIONS.
- O failure-log `2026-10-13-stage-11-no-subscription-open-access.md` registra a regressão, protegida pelos testes SQL de `access_closure.sql`.
