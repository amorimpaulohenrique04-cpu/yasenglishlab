# Evidence — prompt-04-design-system

## Sources inspected

- `docs/UI_CONTRACT.md`
- `docs/DESIGN_SYSTEM.md`
- `docs/ACCESSIBILITY.md`
- `docs/reference-ui/`
- Approved login, home, materiais and progresso screenshots.

## Automated evidence

Read-only green run:

- https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/actions/runs/36515649247
- Foundation format/lint/typecheck/Vitest/Next build: passed.
- Harness contract: passed.
- Security boundary: passed.
- DB structural verification: passed.
- Storybook production build: passed.
- App Playwright E2E: passed.
- Design-system Playwright suite: 6/6 passed.
- Axe WCAG A/AA scan on representative core/form/desktop/mobile stories: no violations.
- Tabs keyboard navigation: passed.
- Dialog Escape behavior: passed.

Visual artifact:

- Artifact ID: `11010707354`
- Artifact name: `design-system-visual-evidence`
- Digest: `sha256:246e9b1e15362a9b0f070d2711c88a6fdc05900b07fed3a3a86091223405c6c9`

## Visual inspection

The generated screenshots were opened and inspected, not accepted only by exit code.

- **Core states:** yellow remains restricted to priority action/progress; purple owns identity and selected/navigation state; white cards sit on a light lilac canvas; success/error/warning include text/symbol semantics.
- **Form controls:** real labels, visible error/success messages, disabled treatment and readable form spacing.
- **Desktop shell (1440×900):** deep-purple sidebar, light lilac content surface, white cards and controlled yellow CTA; demonstrates shell hierarchy without implementing Home.
- **Mobile shell (390×844):** sidebar is removed rather than squeezed; hierarchy stacks cleanly and keeps the priority CTA evident.

## Failures that improved the system

1. Strict TypeScript rejected unsafe optional/index access. Fixed without relaxing `exactOptionalPropertyTypes` or `noUncheckedIndexedAccess`.
2. Axe rejected `aria-label` on a role-less Avatar span. The component semantics were corrected; the Axe rule was not disabled.
3. Visual viewport capture was made explicit per representative story before accepting screenshot evidence.

## Product-scope confirmation

No Home, Aulas, Prática, Materiais, Progresso, Agenda or Perfil page was implemented. No auth, billing, database product schema or business-domain behavior was added.
