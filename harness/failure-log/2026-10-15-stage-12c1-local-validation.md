# Etapa 12 C1 — limites da verificacao local

Classification: state
Status: open
Repeatable: yes
Date: 2026-10-15
PR/commit related: current change, feat/etapa-12-lacunas-operacionais

## Symptom

A suite de agenda nao passa no estado atual da stack isolada; o eval global tambem tem achados anteriores.

## Evidence

`supabase/tests/schedule_booking.sql` falha na linha 107 com
`reserved session identity and usage schedule are immutable` em `private.protect_reserved_session()`.
Reproduzido na stack isolada 55422 com C1 e, depois, com os objetos C1 removidos e as funcoes/policies
anteriores restauradas somente em transacao. Ambas as execucoes terminaram exit 3; a conexao fez rollback.
Logs: `harness/evidence/stage-12-lacunas-operacionais/c1-schedule_booking.log` e `c1-schedule-before.log`.
Isso prova que a falha ja existia naquele estado anterior ao C1; nao prova sucesso numa stack limpa.

## Outras limitacoes

- `eval-agent` compara origin/main...HEAD: inclui alteracoes commitadas da Etapa 11, mas nao o trabalho
  C1 nao commitado. Falha por escopo anterior, `cat response.json || true`, UI anterior sem screenshots
  e inicialmente referencias documentais faltantes no goal. As referencias lidas foram acrescentadas;
  os demais achados nao foram ocultados nem regras enfraquecidas.
- Shims globais npm/npx falham com MODULE_NOT_FOUND. Mitigacao: executar os binarios locais via Node.
  Typecheck, ESLint, Vitest, verify-db, verify-security e verify-harness passaram dessa forma.

## Proximo passo e ratchet

Reset integral somente da stack isolada na sessao de gates, repetir agenda e demais suites,
avaliar a Etapa 12 contra a base correta apos seus commits e obter evidencia visual nas sessoes previstas.
Sem correcao de fixture nesta sessao, sem relaxar imutabilidade/RLS. Registro permanece aberto;
se a falha persistir limpa, reproduzir e adicionar protecao/teste permanente antes de declara-la resolvida.

## Root cause

A fixture tenta alterar uma sessao reservada protegida por imutabilidade. Mesma falha sem C1;
origem exata dos dados residuais ainda nao determinada. O eval usa origin/main...HEAD, incluindo a Etapa 11.

## Responsible layer

Estado das fixtures de banco e selecao da base do harness; shims npm pertencem ao ambiente local.

## Immediate fix

Sem correcao da agenda nesta sessao; gates continuam pendentes. Para as ferramentas locais,
Node executou os binarios instalados diretamente, sem modificar dependencias ou instalacao global.

## Permanent protection

Pendente de diagnostico numa stack limpa; preservar protect_reserved_session e os testes existentes.

## Test/eval created

Prova diagnostica antes/depois do C1 salva em c1-schedule-before.log e c1-schedule_booking.log.
Nao ha teste novo de correcao da agenda, pois a falha nao foi resolvida.

## Reproduction

Na stack isolada 55422: psql -X -v ON_ERROR_STOP=1 -f supabase/tests/schedule_booking.sql.
Repetir com objetos C1 removidos apenas dentro de transacao e fechar a conexao para rollback.

## Before/after proof

Before: sem C1, exit 3 em protect_reserved_session (c1-schedule-before.log).
After: com C1, mesmo exit 3 (c1-schedule_booking.log). Sem alegacao de correcao; registro aberto.
