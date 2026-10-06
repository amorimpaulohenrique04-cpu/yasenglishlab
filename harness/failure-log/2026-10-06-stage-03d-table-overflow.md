# Failure — Billing table intrinsic grid overflow

Classification: ui contract

Status: resolved

Repeatable: yes

Date: 2026-10-06

PR/commit related: feat/stage-03d-billing-ui

## Symptom

Admin Billing gerou scroll horizontal no documento durante o E2E focado.

## Evidence

Admin E2E inicial falhou em document.documentElement.scrollWidth <= innerWidth; a11y e Student passaram.

## Root cause

Grid local manteve min-width automático do Card e recebeu largura intrínseca das sete colunas DataTable, expandindo o documento antes de o frame poder conter seu scroll.

## Responsible layer

UI: CSS Module Billing.

## Immediate fix

min-width: 0 no container local e seu Card, max-width: 100% no container; primitives e globals preservados.

## Permanent protection

O E2E Admin verifica ausência de overflow em 1440/1024/390 e exige lista mobile em 390.

## Test/eval created

tests/e2e/billing-ui.spec.ts: Admin AAL2 billing filters, table and mobile list.

## Reproduction

Executar apenas o E2E Admin com fixture PAST_DUE e filtro status/plano em Supabase local.

## Before/after proof

Before: o E2E Admin detectou scrollWidth maior que innerWidth.

After: apenas o E2E Admin foi repetido e passou em 15,1 s, incluindo os três viewports e a11y.
