# Stage 03C — Public Commercial Flow

Status: in_progress / verified:false. Official CI and merge pending.

Base: `8199ff2f3a7965ebc9ebf1184db30bd3b2af49c7`.
Branch: `feat/stage-03c-public-commercial-flow`.

## Implementation and boundaries

Server-rendered public landing with active monthly BRL Plans and effective entitlement benefits projected through server-only Admin client. No anonymous table grants or policies. Signup uses the existing SDK/SSR and Profile trigger, with a fixed idempotent STUDENT assignment to the SDK-returned identity. Existing or obfuscated responses stay neutral. Role failure is incomplete registration; a 15-minute signed HttpOnly/SameSite retry capability binds only the original signup identity. No role or target comes from FormData; staff roles cannot be augmented by this path. Session/no-session paths are covered separately.

Only exact `/checkout` and `/billing/return` continuations are added for Student. MFA and workspace rules are preserved; login errors now preserve sanitized next. Checkout rechecks Student, live plan and current subscription, then calls unchanged 3A startCheckout and repository. Price comes from the database reservation. ACTIVE navigates via persisted Placement; PAST_DUE/TRIALING block another checkout. Missing Placement fails closed.

Return filters every read by authenticated owner, exposes only plan name and human state, and ignores result. READY/CREATING stay processing, PAID+ACTIVE+real Placement confirm. Manual refresh only. No return/fake handler writes a Subscription or calls beginPlacement. Fake adapter requires development/test + explicit FAKE + CANONICAL_E2E + loopback origin; production/missing configuration reject. `/test-billing/checkout` returns 404 outside the fake guard.

No migrations, dependencies, 3A/3B implementation, onboarding redesign or 3D changes. The new provider selector is documented in `.env.example`. Optional analytics deferred to avoid expanding its event contract.

## Focused verification

Direct installed Node CLIs were used because the machine's global npm/npx wrappers are broken. No broad local verify/full/UI/DB/Storybook or unrelated functional suites ran.

- `node node_modules/vitest/vitest.mjs run tests/unit/auth-routing.test.ts tests/unit/commercial.test.ts`: 10 passed (then only the failed/newly changed test was rerun).
- `node node_modules/vitest/vitest.mjs run tests/integration/commercial.test.ts tests/integration/auth-routing.test.ts`: 19 passed, including the unchanged Student boundary tests in the touched Auth file.
- `node node_modules/typescript/bin/tsc -p tsconfig.commercial.json`: passed.
- Installed Prettier/ESLint on touched files: passed; initial unused retry parameters were removed.
- `node node_modules/@playwright/test/cli.js test tests/e2e/commercial.spec.ts --workers=1`: 1 passed, final run 26.0s. Real local signup and fixed Student role; SDK paid asset reads denied; no ACTIVE before return/webhook; fake success return remains processing even after refresh; authenticated existing webhook returns 204, persists ACTIVE/PAID and initializes real Placement; refreshed return confirms and navigates to existing onboarding. Nine focused axe/responsive/44px-target checks and exactly six screenshots are part of this one scenario.
- `git diff --check`: passed.

Local Supabase was started for actual SDK signup/SSR/PostgreSQL/webhook validation. Only the already-existing pending 3A and 3B migrations were applied to bring that local instance current. No SQL/RLS suite or database migration was added/run for this slice.

## Browser and visual evidence

Installed Playwright Chromium performed the browser verification because the agent-browser CLI is unavailable. Initial live browser check verified root heading, metadata and absence of error overlay. Responsive/a11y checks run in the one commercial scenario, with landing widths 1440/1024/390 and signup/return widths 1440/390. Keyboard label/focus progression is asserted. Evidence filenames are exactly landing-desktop, landing-tablet, landing-mobile, signup, return-processing and return-confirmed PNGs in `screenshots/`.

All six images inspected. Desktop/tablet preserve hierarchy and three Plan cards; mobile stacks naturally without overflow. Signup and return retain existing Yas primitives, labels, contrast and readable error/processing copy. New interactive links meet 44px targets. No fabricated metrics, paid access or activated state comes from redirect.

## Corrections observed

Navigation link styling overrode the existing CTA foreground, producing an axe contrast failure (2.13:1). Scoped non-button styling fixed it; the same canonical axe guard protects it. Initial strict RFC UUID parsing rejected the historical seeded PostgreSQL plan IDs; public projection now accepts PostgreSQL GUIDs, and the integration test uses the actual seed shape. The local fake route was first placed inside a private underscore folder; Next's documented convention required a routable `/test-billing/checkout` folder. SDK signup succeeded but first cold compilation exceeded Playwright's default URL assertion wait; only those navigation waits were raised to 20 seconds. Protected asset assertions use lesson_assets/materials, not the permitted lesson metadata catalog.

The focused E2E also hit ENOSPC while Turbopack persisted this run's generated dev cache. The server was stopped and only its workspace `.next/dev/cache/turbopack` cache removed, recovering approximately 1 GB. No OS, user files, Docker data, package cache or project source was removed.

## Official CI

Pending PR and Official CI. Stage 03A/03B remain done/verified; macro remains in_progress/verified:false; 3D remains planned.
