# Failure — Teacher practice header: mandatory gates not certified

Classification: environment  
Status: open  
Repeatable: yes  
Date: 2026-10-23  
PR/commit related: local delivery (uncommitted)

## Symptom

Mudança visual implementada e revisada em quatro larguras; checks obrigatórios não certificados:

- `verify:ui` exige `CANONICAL_E2E=1`.
- Typecheck falha por sintaxe em `.next/dev/types/routes.d.ts` (148–156).
- `verify:agent` inicial parou em formatação do estado harness.

## Evidence

`harness/evidence/teacher-practice-header/README.md` e logs locais.

## Root cause

`verify:ui`: configuração de teste canônico isolado ausente.

Typecheck: Not recorded in the original entry (syntax error in a generated file, outside the scope).

`verify:agent`: Not recorded in the original entry (the first run stopped at formatting of the harness state files).

## Responsible layer

environment — canonical isolated test configuration; generated `.next` file outside the scope; harness state formatting.

## Immediate fix

Arquivos de estado do harness formatados preservando o conteúdo; a repetição foi registrada em evidence. Nenhuma fixture foi criada no banco de desenvolvimento.

## Permanent protection

Not recorded in the original entry. Nenhuma proteção de teste foi enfraquecida; nenhuma falha recorrente foi declarada resolvida sem prova.

## Test/eval created

Not recorded in the original entry.

## Reproduction

1. Run `verify:ui` without `CANONICAL_E2E=1`; it fails.
2. Run typecheck; it fails at `.next/dev/types/routes.d.ts` (148–156).
3. Run `verify:agent`; the first run stops at formatting of the harness state.

## Before/after proof

Before: the failures listed in Symptom.  
After: Not recorded in the original entry. The visual change was reviewed in four widths, but the mandatory checks were not certified; the task must not be marked done until they pass.
