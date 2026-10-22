# GOAL — teacher-sessions-redesign: Sessões do professor

Status: in_progress
Owner: agent/human
Created: 2026-10-21
Updated: 2026-10-22

## Objective

Implementar o plano aprovado no chat para entrega local: agenda/calendário, criação em etapas, detalhes, Meet manual, consulta de disponibilidade e relatórios CSV/PDF.

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
- `tests/integration/session-resources-projection.test.ts`
- `tests/e2e/teacher-sessions-redesign.spec.ts`
- `tests/e2e/teacher-operations.spec.ts`
- `tests/e2e/core-live.spec.ts`
- `tests/a11y/critical-flows.spec.ts`
- `scripts/run-sql-tests.mjs`
- `eslint.config.mjs`, `tests/unit/isolated-next-config.test.ts`
- `package.json`, `package-lock.json`
- `public/fonts/report-noto-sans-regular.ttf`, `public/fonts/report-noto-sans-LICENSE.txt`
- `public/fonts/report-noto-sans-README.md`
- `docs/LIVE_CLASSES.md`, `docs/UI_CONTRACT.md`
- `harness/**`

O workspace contém alterações anteriores em arquivos do harness; preservar e registrar separadamente. Base local `style/sidebar-fit`, sem incluir mudanças preexistentes no commit da tarefa. Em 2026-10-22 o usuário decidiu entregar localmente, sem abrir PR nem publicar branches.

Gate inicial encontrou formatação preexistente em `harness/evidence/admin-teacher-redesign/README.md`. Correção permitida estritamente de whitespace para liberar o gate global; conteúdo e evidência histórica preservados.

Recursos somente com instruções não devem oferecer botão de arquivo inexistente. A projeção substitui o path server-only por `has_file` e o componente compartilhado omite apenas essa ação sem destino; o acesso protegido existente permanece intacto.

O lint global também percorreu o checkout local preexistente `.level-based-cohorts`, inclusive bundles gerados (26.881 problemas). Permitir somente a exclusão desse checkout no eslint.config.mjs, equivalente à exclusão existente de `.claude`, com teste do isolamento. Código fonte do produto continua integralmente verificado.

## Forbidden areas

- Shell global, mudanças comerciais, novas regras de booking/presença
- Recorrência, criação de Workshop, notas/checklist/mensagens, novos provedores
- Alterações preexistentes não relacionadas

## Mandatory tests

Atualização expressa do usuário em 2026-10-22: não executar os gates completos. Encerrar a entrega local com verificações focadas, aplicar migrations locais, executar `node scripts/dev-seed.mjs` e iniciar localhost. A certificação pelos gates abaixo permanece pendente; não declarar todos os checks verdes.

- npm run verify:agent
- npm run verify:ui
- npm run verify:security
- npm run verify:db
- npm run verify:full

## Required evidence

- harness/evidence/teacher-sessions-redesign/: checks, screenshots e PDF renderizado

## Definition of done

Critérios verificados, gates verdes, evidências inspecionadas, estado registrado e commits locais revisáveis; nenhum PR ou push conforme decisão posterior do usuário.
