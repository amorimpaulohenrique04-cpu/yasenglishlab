# Failure — Billing test adapter type boundary

Classification: test gap

Status: resolved

Repeatable: yes

Date: 2026-10-06

PR/commit related: https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/pull/45

## Symptom

Official CI TypeScript rejeitou o mock de ownership do novo teste de integração.

## Evidence

Run 37534534349: TS2339 em tests/integration/billing-ui.test.ts:190, propriedade eq inexistente no PostgrestQueryBuilder retornado por from antes de select.

## Root cause

O teste atribuía eq diretamente ao builder inicial usando o tipo real do SDK; essa fase só expõe select antes de filtros. O check focado final dos testes não havia sido confirmado por exit code isolado.

## Responsible layer

Testes focados e execução do typecheck local.

## Immediate fix

O adapter de teste recebeu opção explícita ignoreOwnerFilter, mantendo a simulação de resposta indevida sem atribuir filtros a um tipo SDK incompatível.

## Permanent protection

Typecheck focado inclui explicitamente os testes novos e seu exit code é verificado isoladamente; Official CI executa o typecheck amplo antes de Preview.

## Test/eval created

O teste de integração rejects a mismatched owner continua comprovando a defesa de ownership; tsconfig.billing-ui.json inclui tests/integration/billing-ui.test.ts.

## Reproduction

node node_modules/typescript/bin/tsc --noEmit -p tsconfig.billing-ui.json no commit 86bb75e.

## Before/after proof

Before: Official CI 37534534349 e reprodução focada emitiram TS2339.

After: typecheck focado exit 0, ESLint do teste exit 0 e oito testes de integração passaram; UI/source não mudaram.
