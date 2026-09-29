# Yas English Lab — Agent Map

This file is a map, not the manual. Read only the documents needed for the task.

## Start

```bash
nvm use
npm ci
cp .env.example .env.local
npm run dev
```

Windows PowerShell: copy `.env.example` to `.env.local` with `Copy-Item`.

## Sources of truth

- Documentation map: `docs/README.md`
- Product responsibilities: `docs/PRODUCT.md`
- Architecture/data: `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`
- UI: `docs/UI_CONTRACT.md`, `docs/DESIGN_SYSTEM.md`, `docs/reference-ui/`
- Auth/security: `docs/AUTH_RBAC_RLS.md`, `docs/SECURITY.md`
- Domain contracts: the matching file in `docs/`
- Testing/Done: `docs/TESTING.md`, `docs/DEFINITION_OF_DONE.md`
- Undecided items: `docs/OPEN_QUESTIONS.md`
- Harness process: `harness/README.md`

## Before changing code

1. Create/fill a task goal from `harness/GOAL.template.md`.
2. Read the minimum relevant docs.
3. Inspect existing implementation before proposing new structure.
4. Record the small plan in `harness/agent-state/plan.md`.
5. Keep changes inside the declared scope.

## Official verification

```bash
npm run verify:agent
npm run verify:ui        # required for visual changes
npm run verify:security  # required for security/auth changes
npm run verify:db        # required for database/migration changes
npm run verify:full
```

Windows wrappers are available in `scripts/*.ps1`; Bash wrappers are in `scripts/*.sh`.

## Inviolable rules

- Never declare success while a required check is failing.
- Never invent an answer to `docs/OPEN_QUESTIONS.md`.
- Course progress is not CEFR proficiency.
- Paid capabilities use entitlements, not scattered plan-name conditionals.
- `SUPABASE_SERVICE_ROLE_KEY` is server-only; never expose it through `NEXT_PUBLIC_*`.
- Do not weaken RLS/auth/security to make a test pass.
- Do not create duplicate UI primitives when an approved primitive already fits.
- Approved visual references require explicit evidence for intentional changes.
- Do not touch files outside the task scope without updating the goal and recording why.
- Critical TODOs/blockers must be recorded before conclusion.

## Persistent state

- Plan: `harness/agent-state/plan.md`
- Progress: `harness/agent-state/progress.md`
- Decisions: `harness/agent-state/decisions.md`
- Feature/task registry: `harness/feature_list.json`
- Evidence: `harness/evidence/`
- Failures/blockers: `harness/failure-log/`

Model proposes. System executes. Evidence proves. Persistent state records.
