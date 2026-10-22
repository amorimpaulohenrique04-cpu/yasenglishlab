# GOAL — teacher-sessions-redesign: Sessões do professor

Status: in_progress
Owner: agent/human
Created: 2026-10-21
Updated: 2026-10-21

## Objective

Implementar o plano aprovado no chat em um PR: agenda/calendário, criação em etapas, detalhes, Meet manual, consulta de disponibilidade e relatórios CSV/PDF.

## Visible result

Fluxos operacionais responsivos, acessíveis e persistidos, inspirados nas seis referências do usuário.

## Relevant context

- docs/LIVE_CLASSES.md, docs/UI_CONTRACT.md, docs/DESIGN_SYSTEM.md
- docs/ARCHITECTURE.md, docs/AUTH_RBAC_RLS.md, docs/TESTING.md
- docs/SECURITY.md, docs/ACCESSIBILITY.md, docs/DEFINITION_OF_DONE.md
- Plano aprovado no chat em 2026-10-21.

## Acceptance criteria

- Preservar escopo TEACHER+AAL2, entitlements, reservas e attendance.
- Agenda/Semana/Mês e filtros compartilháveis; assistente com erros sem perder dados.
- Detalhes, recursos/tarefas e ações reais; cancelamento confirmado.
- Disponibilidade sem truncamento; relatórios por fatos explícitos e exportação completa.
- Evidência desktop/tablet/mobile e PDF; gates obrigatórios verdes antes de done.

## Allowed files / domains

- `src/app/(protected)/(teacher)/teacher/sessoes/**`
- `src/modules/teacher-operations/**`
- `src/server/teacher-operations/**`
- `supabase/migrations/20261022023701_teacher_sessions_redesign.sql`
- `supabase/tests/teacher_session_workspace.sql`
- `tests/unit/session-workspace.test.ts`
- `tests/integration/session-report-pdf.test.ts`
- `tests/e2e/teacher-sessions-redesign.spec.ts`
- `tests/e2e/teacher-operations.spec.ts`
- `tests/e2e/core-live.spec.ts`
- `tests/a11y/critical-flows.spec.ts`
- `scripts/run-sql-tests.mjs`
- `package.json`, `package-lock.json`
- `public/fonts/report-noto-sans-regular.ttf`, `public/fonts/report-noto-sans-LICENSE.txt`
- `public/fonts/report-noto-sans-README.md`
- `docs/LIVE_CLASSES.md`, `docs/UI_CONTRACT.md`
- `harness/**`

O workspace contém alterações anteriores em arquivos do harness; preservar e registrar separadamente. PR sobre `style/sidebar-fit`, sem incluir commits preexistentes como mudanças da tarefa.

Gate inicial encontrou formatação preexistente em `harness/evidence/admin-teacher-redesign/README.md`. Correção permitida estritamente de whitespace para liberar o gate global; conteúdo e evidência histórica preservados.

Recursos somente com instruções não devem oferecer botão de arquivo inexistente. A projeção substitui o path server-only por `has_file` e o componente compartilhado omite apenas essa ação sem destino; o acesso protegido existente permanece intacto.

## Forbidden areas

- Shell global, mudanças comerciais, novas regras de booking/presença
- Recorrência, criação de Workshop, notas/checklist/mensagens, novos provedores
- Alterações preexistentes não relacionadas

## Mandatory tests

- npm run verify:agent
- npm run verify:ui
- npm run verify:security
- npm run verify:db
- npm run verify:full

## Required evidence

- harness/evidence/teacher-sessions-redesign/: checks, screenshots e PDF renderizado

## Definition of done

Critérios verificados, gates verdes, evidências inspecionadas, estado registrado e PR único revisável.
