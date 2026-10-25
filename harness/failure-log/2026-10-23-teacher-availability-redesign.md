# Failure — Disponibilidade — proteção de campos incompletos

Classification: test gap  
Status: resolved  
Repeatable: yes  
Date: 2026-10-23  
PR/commit related: local delivery (uncommitted)

## Symptom

Ao apagar o conteúdo de um campo de hora, a edição era interrompida: o primeiro helper de prévia tentava converter a string vazia em ISO e lançava RangeError.

## Evidence

Evidência vermelha: o teste "keeps the preview safe while a time field is being cleared" falhou com RangeError em 2026-10-23.

## Root cause

TimeField emite string vazia ao apagar seu conteúdo; o primeiro helper de prévia tentava convertê-la em ISO sem tratá-la.

Secondary (authorization smoke): o smoke inicialmente presumiu que todo SELECT de disponibilidade era privado. A leitura legada de intervalos ativos é autenticada e compartilhada por contrato.

## Responsible layer

Not recorded in the original entry. Affected code: the availability preview helper (`availabilityOccurrences`) and the availability form.

## Immediate fix

`availabilityOccurrences` retorna [] enquanto data/hora não estiverem válidas; o formulário mantém o conteúdo e desabilita a confirmação. Chips de dia também aceitam data temporariamente vazia usando hoje como base.

## Permanent protection

Proteção permanente: `tests/unit/availability-workspace.test.ts`.

Secondary: somente o novo estado pausado recebeu proteção adicional na migration 20261023202030; a leitura legada de intervalos ativos foi preservada.

## Test/eval created

`tests/unit/availability-workspace.test.ts` (permanent protection). Os 5 testes focados passaram após a correção (see Before/after proof).

Secondary: smoke de autorização de disponibilidade, atualizado para verificar as fronteiras corretas (nome não registrado no arquivo original); passou com rollback.

## Reproduction

Apagar o conteúdo de um campo de hora no formulário de disponibilidade (TimeField emite string vazia), ou executar o teste "keeps the preview safe while a time field is being cleared".

## Before/after proof

Before: o teste "keeps the preview safe while a time field is being cleared" falhou com RangeError em 2026-10-23.  
After: após a correção, os 5 testes focados passaram; o smoke de autorização passou com rollback.
