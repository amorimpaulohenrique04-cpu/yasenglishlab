# GOAL — stage-03e-notification-delivery: Transactional delivery

Status: done

Owner: agent

Created: 2026-10-06

Updated: 2026-10-06

## Objective

Entregar notificações transacionais duráveis a partir de Billing aplicado, via outbox e processor server-only atrás de port Resend/Fake.

## Visible result

Três tipos de Notification; EMAIL única; claim atômico bounded; recipient Auth verificado; retries persistidos até cinco attempts.

## Relevant context

Base main@aa7bc4824363b69b1cebdeb5df74b9146ad17ba9; branch feat/stage-03e-notification-delivery. ARCHITECTURE, SECURITY, ADR 0014 e contratos existentes de notifications/Billing 3B.

## Acceptance criteria

- [x] Evento aplicado gera uma Notification e uma delivery; stale/rejected/ignored/duplicate não geram.
- [x] RLS server-only na delivery, ownership da Notification preservado; dois claims concorrentes são disjuntos.
- [x] Templates determinísticos, idempotency estável, retries bounded e falha de email independente de Billing.
- [x] Checks focados e Official CI verdes, comprovados no run 37541866527; fechamento da PR #46 condicionado ao CI do head final.

## Allowed files / domains

Notifications domain/application/ports, adapters Resend/Fake, processor/repository, uma migration aditiva, env, ADR/docs, testes focados, configuração de typecheck/testes SQL focados e Harness/evidence.

scripts/run-sql-tests.mjs recebe somente a suite Notification e seu teste de concorrência, para tornar essa proteção executável no Official CI.

## Forbidden areas

UI, reconciler/migrations históricas Billing, dependências npm, scheduler, Resend webhook, marketing e 3F.

## Mandatory tests

Prettier/ESLint tocados, typecheck focado, unit/integration Notification, SQL/RLS e concorrência claim focados, git diff --check. Official CI é o único gate amplo.

## Required evidence

harness/evidence/stage-03e-notification-delivery/: migration, port/adapters, processor, dedupe/retries, SQL/RLS/concorrência, comandos/resultados e CI. Sem screenshots.

## Definition of done

Acceptance comprovada; 3E done/verified:true após CI verde; 3A–3D e macro preservados; merge e main limpa. Parar antes de 3F.
