# Failure — Gabarito nulo em resposta manual e diálogo de confirmação no canto

Classification: test gap  
Status: open  
Repeatable: yes  
Date: 2026-10-23  
PR/commit related: local delivery (uncommitted)

## Symptom

Abrir o detalhe de Entry Demo com MANUAL_TEXT após ampliar a projeção caiu em "Avaliação indisponível", com ZodError em `responses[1].answerKey`.

Secondary (ui contract): o modal de confirmação ficou em x=0, y=0, e a seta ficou em outra linha.

## Evidence

SQL retorna `answerKey:null` para a resposta manual.

Secondary: screenshot do usuário em 2026-10-23, mostrando o modal em x=0, y=0 e a seta em outra linha.

## Root cause

Contrato de leitura mais restrito que a coluna nullable existente: o parser inicial aceitava apenas record/undefined.

Secondary (ui contract): reset CSS retirou a margem automática nativa do dialog, e o ícone foi passado como conteúdo textual do Button.

## Responsible layer

Not recorded in the original entry. Affected code: `entryEvidenceResponseSchema` and the entry loader; the `ConfirmationDialog` primitive.

## Immediate fix

`entryEvidenceResponseSchema` aceita nullish. Loader reutiliza o contrato. Sem alterações nos gabaritos ou no motor de score.

Secondary: `margin:auto` no primitive, apresentação `confirmation` e `trailingIcon`.

## Permanent protection

Caso manual com `answerKey:null` em `tests/unit/entry-workspace.test.ts`.

Secondary: story `ConfirmationDialog` e teste de centralização/encaixe/Escape/foco em `tests/visual/design-system.spec.ts`.

## Test/eval created

`tests/unit/entry-workspace.test.ts`, caso manual com `answerKey:null`.

Secondary: story `ConfirmationDialog` e teste de centralização/encaixe/Escape/foco em `tests/visual/design-system.spec.ts` (execução adiada por pedido do usuário).

## Reproduction

Abrir o detalhe de Entry Demo com MANUAL_TEXT após ampliar a projeção; o SQL retorna `answerKey:null`.

Secondary (visual): Not recorded as step-by-step reproduction in the original entry; the screenshot shows the modal at x=0, y=0.

## Before/after proof

Before: SQL retorna `answerKey:null`; "Avaliação indisponível" com ZodError em `responses[1].answerKey`; modal em x=0, y=0 (screenshot de 2026-10-23).  
After: teste focado passou e o detalhe foi confirmado no navegador após a correção. Conferência direta no browser confirmou a composição corrigida; a certificação automatizada do visual segue pendente.
