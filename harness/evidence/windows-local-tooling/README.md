# Windows local tooling evidence

## Audited starting state

- Modified before implementation: `scripts/_verify-utils.mjs`, `scripts/verify-core.mjs`, `scripts/verify-full.mjs`, `scripts/verify.mjs`, `tsconfig.json`.
- Generated and untracked: `tsconfig.tsbuildinfo`.
- Temporary runner fixes used conditional or platform-wide shell execution and still exposed DEP0190/path quoting risk.
- No `.gitattributes` existed.
- Reproduced external evidence: Windows checkout `i/lf w/crlf` caused roughly 175 Prettier failures; corrected checkout `i/lf w/lf` passed.

## Structural correction

- `.gitattributes` makes LF a repository checkout invariant and explicitly excludes binary asset formats.
- npm runners invoke the npm JavaScript CLI through the current Node executable; no verification runner needs a shell.
- Confirmed native-command occurrences in SQL verification and Supabase cleanup now use direct execution.
- `verify:platform` provides controlled red-to-green proof and a real path-with-spaces probe without a Windows CI dependency.

## Next.js 16.3.6 TypeScript audit

The installed Next source at `node_modules/next/dist/lib/typescript/writeConfigurationDefaults.js` marks `jsx: "react-jsx"` as required because Next uses the React automatic runtime. Its `type-paths.js` intentionally includes both `.next/types/**/*.ts` and `.next/dev/types/**/*.ts` to avoid configuration churn between build and development. Both generated changes are retained. The expanded `plugins` array is serialization-only. Generated `*.tsbuildinfo` is ignored as a build artifact.

## Verification

Final command results are recorded in `verification.json`. All mandatory non-full gates passed without DEP0190. `verify:full` was not run because Supabase CLI, `psql` and Playwright Chromium are absent; the Docker CLI is installed, but this environment also denied access to the user Docker configuration file.

## Closure by subsequent clean-room evidence

This README preserves the original environment limitation exactly as observed. It was not retrospectively rewritten as a successful full run.

Later evidence in `harness/evidence/pre-p13-environment-gate/` validates the missing prerequisites and executes the full chain successfully on Windows: Docker daemon, Supabase CLI, PostgreSQL/`psql`, migrations + seed, DB integration, RLS, E2E, accessibility, Storybook visual, golden visual and clean-room `npm run verify:full` with exit code 0.

Because the later gate directly exercises the missing completion criterion of `windows-local-tooling`, the registry can be normalized to `done` / `verified: true` while the original `verification.json` and failure logs remain unchanged as historical evidence.
