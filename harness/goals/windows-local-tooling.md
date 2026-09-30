# GOAL — windows-local-tooling: Cross-platform local verification

Status: complete  
Owner: agent/human  
Created: 2026-09-30  
Updated: 2026-09-30

## Objective

Make the repository's existing verification runners and checkout policy work reliably on Windows, Linux CI and paths containing spaces, without changing product behavior or weakening any gate.

## Visible result

A fresh checkout preserves LF, npm-based Node runners execute without indiscriminate shells or DEP0190 warnings, and an executable regression test proves the Windows/path-with-spaces invocation contract without requiring a Windows CI runner.

## Relevant context

- `AGENTS.md`
- `harness/ratchet.md`
- `docs/TESTING.md`
- `docs/CI_CD.md`
- `docs/DEFINITION_OF_DONE.md`
- `scripts/`
- `tsconfig.json`

## Acceptance criteria

- [x] Git attributes enforce LF for repository text while preserving binary files.
- [x] Verification runners execute npm and native tools safely on Windows and Linux, including paths with spaces, without indiscriminate `shell: true`.
- [x] The Windows runner failure class has a deterministic red-to-green regression test and durable failure record.
- [x] The Next.js 16.3.6 TypeScript changes retain only current required/supported configuration.
- [x] Required gates pass, or any external prerequisite blocking `verify:full` is recorded exactly.
- [x] No product, UI, database, migration, RLS, auth, domain or provider behavior changes.

## Allowed files / domains

- `.gitattributes`
- `.gitignore`
- `scripts/**`
- `tests/unit/**`
- `tsconfig.json`
- `harness/goals/windows-local-tooling.md`
- `harness/agent-state/**`
- `harness/feature_list.json`
- `harness/failure-log/**`
- `harness/evidence/windows-local-tooling/**`

## Forbidden areas

- Product and UI source.
- Database, migrations, RLS, auth and domain contracts.
- Providers and approved snapshots/goldens.
- Gate weakening or repository-wide formatting.

## Mandatory tests

- `npm run format:check`
- `npm run lint`
- `npm run typecheck`
- `npm run test:unit`
- `npm run test:integration`
- `npm run verify:harness`
- `npm run verify:security`
- `npm run verify:agent`
- `npm run verify:full` when local Docker, Supabase CLI, PostgreSQL client and Playwright Chromium are available.

## Required evidence

- Before/after runner reproduction and line-ending attribute checks.
- Exact mandatory command results under `harness/evidence/windows-local-tooling/`.
- Durable Ratchet failure record linking the permanent regression test.

## Definition of done

Done means every acceptance criterion passes, mandatory checks pass, evidence was inspected, decisions/progress were recorded, blockers/TODOs were registered, and `harness/feature_list.json` reflects the real state. A written claim without matching system state is not done.
