# Styles

Cross-cutting visual infrastructure lives here.

## Executable sources

- `tokens.css` — canonical CSS custom properties for colors, typography, spacing, radius, shadow, border, breakpoints, z-index and motion.
- `tokens.ts` — typed mirror for TypeScript consumers and tests.
- `design-system.css` — shared primitive/layout styling built on the tokens.
- `src/app/globals.css` — application entry point that imports the shared visual system.

## Rule

Pages and feature modules must reuse an existing token or primitive before introducing a new visual value. A new token or primitive requires a semantic gap, not a page-specific preference.

Approved visual direction and regression rules live in `docs/UI_CONTRACT.md`, `docs/DESIGN_SYSTEM.md` and `docs/reference-ui/`.
