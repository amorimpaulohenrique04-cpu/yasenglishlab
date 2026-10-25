# GOAL — teacher-practice-header: Hierarquia do cabeçalho de Práticas

Status: in_progress
Owner: agent
Created: 2026-10-23
Updated: 2026-10-23

## Objective

Reorganizar o cabeçalho do editor de Práticas do Teacher conforme o pedido e screenshot do usuário: navegação separada, título e estado agrupados, salvamento em linha própria e ações com hierarquia clara.

## Visible result

Breadcrumb acima do cabeçalho; título e badge juntos; salvamento abaixo; prévia discreta, salvar secundário e revisar/publicar violeta. Tablet e celular recompõem as ações sem overflow.

## Relevant context

- docs/{UI_CONTRACT,DESIGN_SYSTEM,ACCESSIBILITY,TESTING,DEFINITION_OF_DONE}.md
- docs/reference-ui/README.md
- node_modules/next/dist/docs/01-app/01-getting-started/11-css.md
- Screenshot do usuário de 2026-10-23 (evidência explícita da alteração visual solicitada).
- src/modules/teacher-operations/ui/{practice-builder.tsx,practices.module.css}

## Acceptance criteria

- [x] Navegação, identificação/estado e ações possuem agrupamentos distintos.
- [x] Estados, handlers e rótulos existentes preservados.
- [ ] Desktop/tablet/mobile sem sobreposição ou overflow; títulos longos quebram.
- [ ] Checks obrigatórios verdes e evidência visual inspecionada.

## Allowed files / domains

- src/modules/teacher-operations/ui/practice-builder.tsx
- src/modules/teacher-operations/ui/practices.module.css
- harness/goals/teacher-practice-header.md
- harness/agent-state/{plan,progress,decisions}.md
- harness/feature_list.json
- harness/evidence/teacher-practice-header/**
- harness/failure-log/_teacher-practice-header_

## Forbidden areas

Banco, auth, ações de servidor, regras de publicação, player e alterações preexistentes de outras tarefas.

## Mandatory tests

- npm run verify:agent
- npm run verify:ui
- Revisão no navegador em desktop/tablet/mobile.

## Required evidence

Logs dos checks e capturas do cabeçalho em harness/evidence/teacher-practice-header/.

## Definition of done

Critérios e checks obrigatórios passam; evidência inspecionada; registry e estado refletem o resultado real. Bloqueios registrados sem declarar certificação.
