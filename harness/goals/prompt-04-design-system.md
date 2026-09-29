# GOAL — prompt-04-design-system: Executable Yas Design System

Status: in_progress  
Owner: agent  
Created: 2026-09-28  
Updated: 2026-09-28

## Objective

Transform the approved Yas UI contract and visual references into an executable token system, reusable primitives, layout primitives and Storybook catalog without implementing complete product pages.

## Visible result

A developer can open Storybook and compose future Yas screens from approved tokens/components that visibly preserve the purple navigation, light/lilac surfaces, white cards, controlled yellow primary actions, consistent radius, low density and hierarchy of the reference UI.

## Relevant context

- `docs/UI_CONTRACT.md`
- `docs/DESIGN_SYSTEM.md`
- `docs/ACCESSIBILITY.md`
- `docs/reference-ui/`
- `docs/TESTING.md`
- existing `src/components/ui/` and `src/components/layout/`

## Acceptance criteria

- [ ] Required token categories exist and are reusable.
- [ ] Planned primitives exist without duplicating semantic jobs.
- [ ] Interactive primitives expose keyboard/focus behavior appropriate to their semantics.
- [ ] Storybook covers states beyond happy path, including long text/mobile/focus/disabled/loading/error.
- [ ] Storybook accessibility addon is enabled and automated axe smoke finds no serious/critical violations in representative stories.
- [ ] Visual screenshots are produced from real Storybook stories.
- [ ] `npm run verify:agent` and `npm run verify:ui` pass.
- [ ] No complete product page is implemented.

## Allowed files / domains

- `src/components/ui/**`
- `src/components/layout/**`
- `src/styles/**`
- `src/app/globals.css`
- `.storybook/**`
- `tests/visual/**`
- design-system tests/config/scripts
- package/lockfile, CI and harness state/evidence needed for verification

## Forbidden areas

- Product page implementation.
- Product modules/business rules.
- Auth/billing/database product work.
- Approved reference images.

## Mandatory tests

- `npm run verify:agent`
- `npm run verify:ui`
- Storybook static build
- Playwright visual/a11y suite

## Required evidence

- Storybook catalog build.
- Screenshot artifact(s) of primary states and mobile shell.
- Axe result.
- lint/typecheck/test/build outputs.
- Changed-file scope review.

## Definition of done

All acceptance criteria pass, visual/a11y evidence has been inspected, the behavioral eval is satisfied, progress/decisions are recorded, and the feature registry is `done` + `verified: true` with durable evidence.
