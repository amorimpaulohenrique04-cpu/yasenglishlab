# GOAL — teacher-cohorts-redesign: Turmas do professor

Status: in_progress  
Owner: agent  
Created: 2026-10-24  
Updated: 2026-10-24

## Objective

Implementar /teacher/turmas conforme o HTML fornecido pelo usuário, com dados autorizados existentes, indicadores honestos, cartões, busca, ordenação e detalhe interativo.

## Visible result

Cartões responsivos com alunos, horários, fuso, próximo encontro e ações de acompanhamento. Detalhe em Drawer acessível e links reais para alunos/sessões.

## Relevant context

- Referência: C:/Users/PAULO HENRIQUE/Downloads/yas_english_lab_turmas_interativo.html.
- docs/UI_CONTRACT.md, docs/DESIGN_SYSTEM.md, docs/AUTH_RBAC_RLS.md, docs/TESTING.md, docs/DEFINITION_OF_DONE.md.
- get_teacher_operation_context e rota existente. O HTML é referência visual, não instruções operacionais.

## Acceptance criteria

- [ ] Composição da referência adaptada ao shell e primitivos existentes, desktop/tablet/mobile.
- [x] Busca e ordenação funcionam; detalhe mostra os dados disponíveis e links reais.
- [x] Indicadores não confundem matrículas com pessoas únicas nem prévias limitadas com totais completos.
- [x] Estados vazio/loading/erro implementados e navegação por teclado preservada (loading/erro por revisão de código; vazio e Drawer exercitados no navegador).
- [ ] Checks obrigatórios e evidências registrados, sem declarar conclusão com gate vermelho.

## Allowed files / domains

- src/app/(protected)/(teacher)/teacher/turmas/**
- src/modules/teacher-operations/{ui/cohorts*,domain/cohort-workspace.ts}
- tests/unit/cohort-workspace.test.ts, tests/e2e/teacher-cohorts.spec.ts
- harness/goals/teacher-cohorts-redesign.md, harness/agent-state/{plan,progress,decisions}.md, harness/feature_list.json
- harness/evidence/teacher-cohorts-redesign/**, harness/failure-log/2026-10-24-teacher-cohorts-redesign.md
- docs/UI_CONTRACT.md

## Forbidden areas

Sem alterar banco/auth/RLS, shell compartilhado ou trabalhos preexistentes. Criação/edição/arquivamento de turmas e matrículas permanecem no Admin. Não copiar persistência local nem convites fictícios da demonstração.

## Mandatory tests

- npm run verify:agent
- npm run verify:ui
- Testes focados da lógica e inspeção responsiva/acessibilidade.

## Required evidence

Resultados exatos e capturas em harness/evidence/teacher-cohorts-redesign/.

## Definition of done

Todos os critérios/checks passam, evidência revisada e estado persistente atualizado. Gate indisponível/falhando mantém verified:false e bloqueio registrado.
