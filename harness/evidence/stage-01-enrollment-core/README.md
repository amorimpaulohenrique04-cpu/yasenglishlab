# Stage 01 verification checkpoint

Base: `22b0562eaf308fabd363107feeecb639a126484e`, fetched and matched before branch creation. Branch: `feat/stage-01-enrollment-core`. No prior Placement domain found.

Observed on 2026-10-03:

- Focused unit/application: 2 files, 9 tests passed.
- Initial clean Supabase local replay applied all migrations and seed, including Enrollment Core.
- `psql ... -v ON_ERROR_STOP=1 -f supabase/tests/placement.sql`: passed the actual lifecycle, retries, staff scope/AAL2, private scoring column denial, direct DML denial, immutable review and audited transfer.
- `node scripts/test-placement-concurrency.mjs`: passed real two-connection last-seat race (one winner, one capacity denial), rollback of losing enrollment and concurrent identical review/choice retries.
- Runtime and new tests typecheck after narrow fixture literal/MFA-helper corrections: passed.
- Focused ESLint over new runtime/tests: passed.

Full workspace lint traversed an existing local `.venv-laya/Lib/site-packages/torch/utils/model_dump/code.js` and failed `no-this-alias` in third-party code. It is outside the Git diff. No user files were deleted/moved and no lint/gate suppression was added. Broad gates will run on an isolated checkout of the implementation commit, without that unrelated Python installation.

Browser journey, new a11y/visual evidence, full aliases and Official CI are still pending at this checkpoint; registry remains in_progress / verified:false. Laya classifications were used only for triage; ambiguous scope answers were discarded in favor of explicit user scope and repository contracts.

Design intent: new onboarding/Assessment/Placement and staff surfaces compose existing shell, cards, fields, alerts and buttons. Existing approved product goldens are preserved. Pending Home is intentionally a small next-step projection, without course-track content.
