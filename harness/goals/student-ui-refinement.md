# GOAL — student-ui-refinement: Refinamento UI/UX da área do aluno

Status: in_progress  
Owner: agent  
Created: 2026-10-15  
Updated: 2026-10-15

## Objective

Polir a área do aluno após o redesign (branch `feat/ui-redesign`) a partir do feedback do usuário: CTAs claros em Aulas, resumos sem texto de desenvolvimento, Prática navegável por aula estudada, alinhamentos em Materiais/Progresso, hierarquia de ações na Agenda e Perfil na sidebar de todos os papéis.

## Visible result

- Aulas: cada aula disponível tem botão (Começar/Continuar/Revisar); resumo sem descrição de seed.
- Prática: sem nota "Sinais de prática…"; seção "Pratique o que você estudou" agrupando atividades por aula vinculada (`related_lesson_id`); habilidades como filtro em chips.
- Materiais: busca/filtros alinhados; badges com coluna fixa.
- Progresso: painéis Prática e Encontros ao vivo com mesma altura/estrutura.
- Agenda: CTA primário "Entrar no encontro", secundário "Recursos e tarefas", terciário "Cancelar reserva"; "Reservado" como badge.
- Sidebar: item "Perfil" (grupo Conta) em todos os papéis.

## Relevant context

`docs/UI_CONTRACT.md`, `docs/PRACTICE_ENGINE.md` (não copiar módulos de Aulas para Prática; escolha por habilidade; revisão relacionada ao curso), plano `C:\Users\PAULO HENRIQUE\.claude\plans\o-design-base-foi-calm-peacock.md`.

## Acceptance criteria

- [ ] Itens acima observáveis em desktop/tablet/mobile como `student.dev@example.test`.
- [ ] Nenhuma Server Action, RLS, domínio ou dado alterado.
- [ ] typecheck, lint, unit, e2e/a11y afetados passam; goldens de aulas/progresso atualizados apenas com evidência intencional.

## Allowed files / domains

- `src/components/layout/**`, `src/app/(protected)/(student)/**/page.tsx`
- `src/modules/{learning,practice,materials,progress,schedule}/ui/**`
- `src/styles/design-system.css` (se necessário), testes e goldens afetados, `harness/**`

## Forbidden areas

- `src/server/**`, `supabase/**`, actions, RLS, billing.
- Decisões de produto em `docs/OPEN_QUESTIONS.md`.

## Mandatory tests

- `npm run verify:agent`
- `npm run verify:ui`

## Required evidence

- Screenshots em `harness/evidence/student-ui-refinement/`.
- Resultados dos comandos.
