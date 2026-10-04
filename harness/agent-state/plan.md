# Agent Plan

## Active task

**stage-02-operations**

Base `34f5e32f313fe16b8c09bcf13b64b4a7d11b9236`; branch `feat/stage-02-operations`.

1. Preserve completed Admin Overview, Students/Student 360, and Admin Teachers work and its historical E2E teardown/credential caveats.
2. Implement only missing deltas for Admin Cohorts V2, Teacher operational surfaces, and CRM Leads V1, following the Stage 02 request and local domain/security contracts.
3. For each block: inspect only its contracts and implementation; use Laya multilingual for block routing and material failures; make the smallest change; run focused application, SQL/RLS, E2E/a11y/visual checks as applicable.
4. Audit Stage 01/P21 regressions and all Stage 02 acceptance criteria, repair focused gaps, then run final gates sequentially and diagnose failures causally. Keep E2E screenshots in per-test Playwright output plus attachments so gates cannot overwrite retained Stage 01/P21/Stage 02 evidence.
5. Update evidence/Harness, commit coherent changes, push only `feat/stage-02-operations`, open a PR to `main`, inspect the actual Official CI run and final-Harness-state CI. Never merge `main`; retain `in_progress` / `verified:false` until every required condition is evidenced.
