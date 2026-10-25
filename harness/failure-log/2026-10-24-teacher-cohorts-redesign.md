# Failure — Teacher cohorts redesign: verification pending

Classification: environment  
Status: open  
Repeatable: no  
Date: 2026-10-24  
PR/commit related: local delivery (uncommitted)

## Symptom

- `verify:ui` falhou exigindo `CANONICAL_E2E=1` e fixture Supabase canônica.
- `verify:agent`: a primeira execução efetiva parou na formatação de `plan.md`; a segunda parou em integração com ENOENT no cache temporário de transformação do Vitest (9 arquivos não carregaram, 30 passaram e 274 testes passaram).
- `verify-harness`: registro preexistente `2026-10-21-admin-overview-invalid-uuid.md` (fora do escopo) tem `Repeatable` fora de yes/no e Before/after proof ausente.
- `eval-agent`: scope global não corresponde a este recorte e inclui mudanças preexistentes de outros trabalhos.
- Captura visual da referência `file:` negada pela política de URLs do navegador. Override de viewport do conector falhou; `innerWidth` observado 1536.

## Evidence

`harness/evidence/teacher-cohorts-redesign/`, incluindo `integration-retry.log`.

Browser real (desktop e detalhe) confirmou busca, estado vazio/limpeza, ordenação, Drawer, Escape/retorno de foco e agenda com cohort na URL e no seletor. Validações focadas: TypeScript, ESLint e quatro testes unitários passaram.

Tablet/mobile e axe real permanecem pendentes.

## Root cause

`npm.ps1` resolve um `npm-cli.js` inexistente no perfil roaming.

ENOENT na integração: a causa de concorrência/cache permanece hipótese; não foi reproduzida deterministicamente.

## Responsible layer

environment — `npm.ps1` wrapper no perfil roaming. A concorrência/cache do Vitest sob paralelismo é hipótese não confirmada.

## Immediate fix

Uso do npm oficial já instalado em `C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js` permitiu executar os gates sem alterar o ambiente global. Formatação de `plan.md` corrigida. Retry de integração com `--maxWorkers=1` passou; nenhuma configuração global foi alterada.

## Permanent protection

None — o ENOENT não foi reproduzido deterministicamente, então nenhuma proteção fictícia foi adicionada e nenhuma configuração global foi alterada. No registro original não há proteção para os itens do npm wrapper ou de `CANONICAL_E2E`.

## Test/eval created

E2E/a11y de Turmas adicionado para executar no ambiente canônico (requer `CANONICAL_E2E=1`).

## Reproduction

1. Run `verify:agent`; a integração apresenta ENOENT no cache do Vitest (9 arquivos não carregaram).
2. Retry da integração com `--maxWorkers=1`.
3. Run `verify:ui` sem `CANONICAL_E2E=1`; it fails.

## Before/after proof

Before: integração com ENOENT: 9 arquivos não carregaram, 30 passaram e 274 testes passaram.  
After: retry de integração com `--maxWorkers=1` passou: 39 arquivos/358 testes, um teste opcional ignorado pela configuração existente.
