# Agent Plan

## Active task

**prompt-04-design-system**

Goal: turn the approved Yas visual language into reusable, accessible code without implementing complete product pages.

### Allowed scope

- `src/components/ui/**`
- `src/components/layout/**`
- `src/styles/**`
- `src/app/globals.css`
- `.storybook/**`
- `tests/visual/**`
- design-system specific unit tests
- verification scripts/config needed for Storybook/a11y/visual evidence
- `package.json`, `package-lock.json`
- Harness state/evidence
- CI wiring needed to verify this task

### Forbidden

- Home/Aulas/Prática/Materiais/Progresso/Agenda/Perfil implementation.
- Product-domain behavior.
- Auth, billing or database schema.
- Editing approved reference screenshots.

### Plan

1. Extract visual invariants/tokens from approved docs and references.
2. Audit existing primitives before creating new components.
3. Implement the token API and recurring primitives only.
4. Implement AppShell/Sidebar/Topbar/ContentContainer as layout primitives, not product pages.
5. Add representative Storybook stories covering states, long text, focus, mobile, loading, disabled and error.
6. Add automated axe + keyboard/visual smoke on Storybook.
7. Produce screenshot artifacts from real stories.
8. Run `verify:agent` and `verify:ui`.
9. Inspect evidence and only then mark the registry done.
