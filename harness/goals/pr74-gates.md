# GOAL — pr74-gates: corrigir o redesign e otimizar os gates da PR 74

Status: in_progress
Owner: agent
Created: 2026-10-15
Updated: 2026-10-15

## Objective

Corrigir regressões e expectativas obsoletas da PR 74, mantendo todas as suítes obrigatórias e reduzindo repetição de falhas e preparação de CI.

## Visible result

UI aprovada acessível e responsiva; publicação, progresso e feedback preservados; CI verde no novo commit, sem merge.

## Relevant context

- `docs/TESTING.md`, `docs/DEFINITION_OF_DONE.md`, `docs/UI_CONTRACT.md`, `docs/DESIGN_SYSTEM.md`, `docs/ACCESSIBILITY.md`
- `harness/README.md`, `harness/ratchet.md`, `harness/goals/ui-redesign-approved-proposal.md`
- https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/pull/74
- https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/actions/runs/38816615381

## Acceptance criteria

- [ ] Todas as suítes obrigatórias passam sem skip, retry ou redução de cobertura.
- [ ] Contraste AA, reflow e foco corrigidos; testes acompanham disclosure e navegação reais.
- [ ] Goldens independentes revisados em Linux e Windows; referências reproduzíveis versionadas.
- [ ] Duração antes/depois e evidência dos gates registradas.

## Allowed files / domains

- `src/components/**`, `src/styles/**`, `src/modules/**`, `src/app/**` — apenas apresentação do redesign e correções demonstradas.
- `.gitignore`, `.prettierignore`, `eslint.config.mjs` — excluir saídas geradas e preservar referências HTML byte a byte.
- `next.config.ts`, `tsconfig.verify.json` — impedir que a verificação isolada leia tipos transitórios do servidor dev do usuário.
- `tests/**`, `scripts/**`, `.github/**`, `playwright*.ts`, `package.json`
- `docs/**`, `harness/**`, `artifacts/design-proposal/**`, `public/brand/**`, `public/fonts/**`

## Forbidden areas

- Migrations, RLS, RPCs, auth guards, regras de domínio, server actions e novas funcionalidades de produto.
- Arquivos locais alheios à tarefa; merge da PR.

## Mandatory tests

- `npm run verify:agent`
- `npm run verify:ui`
- `npm run verify:full`
- Testes dos gates e cenários anteriormente falhos.

## Required evidence

- `harness/evidence/pr74-gates/` — comandos, capturas, diferenças visuais e tempos locais/CI.
- `harness/failure-log/pr74-gates.md` — prova vermelho/verde e proteção permanente.

## Definition of done

Todos os critérios passam; evidência inspecionada, estado persistido e CI verde na PR 74, sem merge.
