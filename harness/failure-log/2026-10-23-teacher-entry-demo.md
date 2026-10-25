# Failure — Teacher entry demo: general certification pending

Classification: environment  
Status: open  
Repeatable: yes  
Date: 2026-10-23  
PR/commit related: local delivery (uncommitted)

## Symptom

`verify:agent` falha em `.next/dev/types/routes.d.ts:148–156` por sintaxe no arquivo gerado pelo Next. Mesmo bloqueio preexistente da tarefa teacher-practice-header.

## Evidence

Evidência: `harness/evidence/teacher-entry-demo/verify-agent.log` e `README.md`. Formato/lint globais passaram.

## Root cause

Not recorded in the original entry. The entry attributes the failure to a syntax error in a generated Next.js file (`.next/dev/types/routes.d.ts`, lines 148–156).

## Responsible layer

environment — generated file `.next/dev/types/routes.d.ts`, outside the task scope.

## Immediate fix

Pedido de dados executado: quatro casos REVIEW_PENDING com duas respostas, visíveis no navegador e na RPC autenticada. Seed repetido sem duplicação. Arquivo gerado fora do escopo, não alterado; nenhuma proteção enfraquecida.

## Permanent protection

Not recorded in the original entry.

## Test/eval created

Not recorded in the original entry. Checks that passed: `verify:db`, syntax and lint of the seed script.

## Reproduction

Run `verify:agent`; it fails at `.next/dev/types/routes.d.ts:148–156`.

## Before/after proof

Before: `verify:agent` falha em `.next/dev/types/routes.d.ts:148–156`.  
After: Not recorded in the original entry. General certification pending; global format and lint passed.
