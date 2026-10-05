# Agent Plan

## Active task

**student-home-approved-design**

Base `58b9a3d85ed8a94fdde9b3f3839821128c3eaca4`; branch `refactor/student-home-approved-design`.

1. Freeze the existing Student Home domain/application contracts before presentation work: three concurrent reads, primary-action priority, partial/error semantics, Server Component boundary and accessible names.
2. Add only the smallest bounded read-model delta needed by the approved design: derive up to three upcoming lessons from the already-loaded Learning projection; do not add a repository method or server query.
3. Refactor only the Student Home page composition and Home-scoped CSS. Reuse current Card/Badge/ProgressBar primitives and design tokens. Do not alter StudentShell, layout.css or global Design System behavior.
4. Run focused unit/integration validation before visual work is considered stable. Diagnose a failing test before editing; do not weaken tests.
5. Inspect desktop/tablet/mobile output, then update only intentional Home golden baselines. Never change the golden tolerance and never replace Login/Aulas/Progresso baselines.
6. Run `verify:agent`, `verify:ui` and one final `verify:full`; publish a PR and inspect Official CI. Keep `verified:false` until actual evidence is green.
