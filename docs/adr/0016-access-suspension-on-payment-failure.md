# ADR 0016 — Access suspension on payment failure

## Status

accepted (supersedes decision 1 of ADR 0015)

## Date

2026-10-13

## Context

O ADR 0015 manteve o conteúdo liberado em `PAST_DUE` e bloqueou só novas reservas. O product owner esclareceu o fluxo padrão de assinatura: a mensalidade não tem juros nem multa, e quem não pagou tem o **acesso suspenso até normalizar**. Nenhum dado é apagado.

## Decision

1. **Suspensão derivada do estado da assinatura.** Para um aluno com assinatura, o acesso a conteúdo (aulas, materiais, prática, vídeo) e a reservas/entrada em aulas ao vivo exige assinatura `ACTIVE` ou `TRIALING`. `PAST_DUE`, `EXPIRED` e `CANCELLED` suspendem o acesso. Não há período de carência.
2. **Sem mutação de matrícula.** `enrollments`, `cohort_memberships`, progresso e histórico não são alterados pela suspensão. A restrição é calculada a partir de `subscriptions.status` (função/política única, reutilizável), de modo que a normalização restaura o acesso sem job de restauração.
3. **Normalização automática.** Um evento de pagamento `CONFIRMED` aplicado pelo reconciler volta a assinatura para `ACTIVE` (comportamento já existente) e o acesso retorna imediatamente.
4. **Reservas futuras.** Em `PAST_DUE` as reservas são preservadas, mas o acesso à sala fica bloqueado enquanto durar a suspensão. Em `EXPIRED`/`CANCELLED`/reembolso, reservas futuras são liberadas como cancelamento antecipado (ADR 0008).
5. **Quem não é afetado.** Staff e usuários sem nenhuma assinatura (seed/legado) não são sujeitos ao gate. Alunos legados sem assinatura devem ser tratados pela decisão 4 do ADR 0015.
6. **Valor.** Sem juros em plano mensal, a comparação estrita de valor (`AMOUNT_MISMATCH`) é intencional.
7. As demais decisões do ADR 0015 (cancelamento pelo usuário via Asaas, transferência de coorte, aluno sem coorte, cancelamento do professor) permanecem válidas.

## Alternatives

Manter conteúdo em `PAST_DUE` (ADR 0015) foi rejeitado pelo product owner. Suspender alterando `enrollments.status` foi rejeitado: exige job de restauração e perde a distinção entre matrícula encerrada e matrícula suspensa por pagamento.

## Consequences

Exige um gate de acesso central (RLS/função SQL e camada de aplicação), UI de aluno suspenso com caminho de regularização (link/2ª via do Asaas) e testes negativos por tabela afetada. A tela de estado da assinatura passa a ser parte do critério de aceite, para o aluno entender por que perdeu acesso. Revisão humana obrigatória (RLS, billing).
