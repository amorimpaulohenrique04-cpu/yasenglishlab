# PRE-P13 local environment gate evidence

## Environment

- Windows host with Node `v24.19.0` and npm `11.17.0`.
- Docker CLI `29.8.1`; Docker Desktop daemon validated with `docker info` and `docker ps` on WSL2.
- Official Supabase CLI `2.118.0`, installed through Scoop.
- PostgreSQL client `psql 18.6`, with the existing Scoop binary added to the user PATH.
- Playwright `1.58.2`; its matching Chromium bundle was installed and exercised by every browser suite.

## Local Supabase isolation

The checked-in `supabase/config.toml` uses the isolated local port range `55320` through `55329` so it does not collide with the unrelated local Supabase project already using the default ports. `supabase status -o env` returned valid API, database, publishable and secret-role values; credential values were kept process-local and are intentionally omitted here.

The first start also proved that the cached official `public.ecr.aws/supabase/postgres-meta:v0.99.0` image was corrupt: its container `package.json` was zero bytes. Only that exact cache image was removed and re-pulled. No Docker volume, unrelated project or production resource was modified.

## Reproducibility proof

The final sequence started with `supabase stop --no-backup`, then ran `supabase start`, `supabase db reset`, direct `npm run verify:ui`, and the official `npm run verify:full`.

- All historical migrations applied from zero and `supabase/seed.sql` completed.
- DB integration passed both SQL files; RLS passed its SQL suite.
- Direct UI verification passed E2E 2/2, accessibility 4/4, Storybook visual 6/6 and platform-specific golden regression 3/3.
- The subsequent full gate repeated the database reset and passed core/build, DB integration, RLS, E2E 2/2, accessibility 4/4, Storybook build, Storybook visual 6/6 and golden regression 3/3.
- `npm run verify:full` printed its official success message and returned exit code 0, then stopped the Yas Supabase stack without backup.

No production credentials were used or persisted, no RLS/test threshold was weakened, and no Prompt 13 product feature was started.
