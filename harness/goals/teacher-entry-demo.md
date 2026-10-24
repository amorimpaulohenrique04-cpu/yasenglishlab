# GOAL — teacher-entry-demo: Dados fictícios na Entrada do Teacher

Status: in_progress
Owner: agent
Created: 2026-10-23
Updated: 2026-10-23

## Objective

Popular a fila de Entrada do professor de desenvolvimento com quatro alunos fictícios e respostas distintas, usando o teste publicado e os comandos existentes.

## Visible result

Quatro avaliações pendentes com nomes identificados como Demo, detalhes e respostas acessíveis ao professor local.

## Relevant context

- docs/PLACEMENT.md
- docs/AUTH_RBAC_RLS.md
- docs/TESTING.md
- docs/DEFINITION_OF_DONE.md
- scripts/dev-seed.mjs
- src/server/placement/placement.ts

## Acceptance criteria

- [x] Quatro casos fictícios visíveis na fila e detalhes revisáveis.
- [x] Seed restrito a localhost e idempotente sem reiniciar casos revisados.
- [x] Dados preexistentes preservados; nenhuma alteração de schema, RLS ou UI.

## Allowed files / domains

- scripts/dev-seed-teacher-entry.mjs
- harness/goals/teacher-entry-demo.md
- harness/agent-state/{plan,progress,decisions}.md
- harness/feature_list.json
- harness/evidence/teacher-entry-demo/**
- harness/failure-log/_teacher-entry-demo_
- Supabase local: novos usuários *.entry-demo@example.test, profiles, user_roles STUDENT, subscriptions sintéticas, atribuição ao teacher.dev@example.test e tentativas/casos/respostas via RPCs existentes.

## Forbidden areas

Produção, usuários reais, alteração de senhas existentes, resets, migrations, schema, RLS, layout e outras abas.

## Mandatory tests

- node --check scripts/dev-seed-teacher-entry.mjs
- Execução e repetição do seed + queries e navegador autenticado.
- npm run verify:agent
- npm run verify:db

## Required evidence

Logs e screenshot em harness/evidence/teacher-entry-demo/.

## Definition of done

Critérios e checks obrigatórios verdes; registrar limitações e manter verified:false se houver bloqueios preexistentes.
