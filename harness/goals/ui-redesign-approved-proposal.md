# GOAL — ui-redesign-approved-proposal: aplicar a proposta visual aprovada (aluno, professor, admin)

Status: in_progress
Owner: agent
Created: 2026-10-16
Updated: 2026-10-16

## Objective

Levar a UI real das três áreas (aluno, professor, admin) à linguagem visual dos protótipos aprovados em `artifacts/design-proposal/{aluno,professor,admin}.html`, sem mudar comportamento, rotas, server actions, autorização ou regras de domínio. Telas que o código suporta e o protótipo não mostra seguem o mesmo padrão visual.

## Visible result

Sidebar roxa sólida com onda e logo, títulos em Montserrat ExtraBold, heros roxos com foto, pílulas, cards arredondados, tags pastel, CTA amarelo, mobile recomposto (tab bar inferior no aluno, nav em pílulas no staff), em desktop, tablet e mobile.

## Relevant context

- Protótipos e notas: `artifacts/design-proposal/README.md`
- `docs/UI_CONTRACT.md`, `docs/DESIGN_SYSTEM.md`, `docs/ACCESSIBILITY.md`, `docs/reference-ui/README.md`
- Plano da sessão: `C:\Users\PAULO HENRIQUE\.claude\plans\c-users-paulo-henrique-downloads-profes-jiggly-sky.md`

## Fases

0. Fundação: tokens, fontes, assets placeholder, ícones, shell, primitivos, Storybook.
1. Aluno. 2. Professor. 3. Admin. Cada fase verificada e commitada em separado.

## Acceptance criteria

- [ ] Tokens `--yas-*` remapeados para os valores medidos do protótipo; nenhum nome existente removido.
- [ ] Montserrat (títulos) e Inter (corpo) carregadas pelo app, sem depender de fonte instalada.
- [ ] Navegação por papel centralizada num único config por shell (sem duplicação no drawer).
- [ ] Nenhum dado inventado: blocos do protótipo sem dado real (sequência, minutos, favoritos, conquistas, busca, sino) omitidos ou em estado vazio honesto.
- [ ] Regras preservadas: progresso do curso separado do nível CEFR; admin não revisa placement; estados da Etapa 11.
- [ ] Sem rolagem horizontal em 1440/834/390; foco visível; estado não só por cor; reduced-motion respeitado.
- [ ] Goldens regenerados só para telas redesenhadas, com diferença declarada em evidência.

## Allowed files / domains

- `src/styles/**`, `src/components/**`, `src/app/layout.tsx`, `src/app/globals.css`
- `src/modules/*/ui/**` (apresentação), páginas em `src/app/(protected)/**` (apenas marcação/estilo)
- `public/brand/**`, `public/fonts/**`
- `tests/visual/**`, `tests/e2e/**` e `tests/a11y/**` apenas para nomes/estrutura alterados com justificativa
- `docs/UI_CONTRACT.md`, `docs/DESIGN_SYSTEM.md`, `docs/reference-ui/**`, `harness/**`

## Forbidden areas

- Migrations, RLS, RPCs, server actions, `src/server/**`, billing/webhooks, auth guards.
- Mudanças de produto ou respostas a `docs/OPEN_QUESTIONS.md`.

## Mandatory tests

- `npm run typecheck`, `npm run lint`, `npm run test:unit`
- `npm run storybook:build`, `npm run test:e2e` (áreas tocadas), `npm run test:a11y`
- `npm run verify:ui` (CANONICAL_E2E=1), `npm run verify:agent`, `npm run verify:full` no fim

## Required evidence

- `harness/evidence/ui-redesign-approved-proposal/` com capturas por fase e resultado de comandos.

## Definition of done

Done means every acceptance criterion passes, mandatory checks pass, evidence was inspected, decisions/progress were recorded, blockers/TODOs were registered, and `harness/feature_list.json` reflects the real state. A written claim without matching system state is not done.
