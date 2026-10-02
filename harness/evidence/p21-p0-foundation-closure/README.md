# P21 foundation evidence

Branch: `feat/p21-p0-foundation-closure`. Base main: `94b574b40b8b05ed798f996294d2297ba92b5e31`.

## Checkpoints

- P21.1: role-aware next/defaults, real staff MFA and multi-workspace selector; explicit Student role boundary.
- P21.2: immutable usage snapshots, one resolved configuration per decision, session/user/booking lock protocol, quota/capacity, cancel/rebook and minimal denial audit.
- P21.3: nullable session cohort, membership episodes with enrollment prerequisite, admin commands, direct/RPC cohort isolation and additive legacy Teacher scope.

## Observed evidence

- `focused-browser.log`: four real browser scenarios passed, including TOTP and axe checks; no timeout relaxation.
- `focused-db-final.log`: real PostgreSQL SQL/RLS plus synchronized capacity/quota/retry races. Final full verification also runs the extended Teacher cancellation races.
- `upgrade-base.log` and `upgrade-result.log`: real main migration chain and legacy upgrade; old over-quota facts preserved, missing-cancellation ambiguity blocks preflight, unresolved provenance explicit, original UUID RPC retained.
- `replay-final-2.log`: clean migration/seed replay. The final full gate and Official CI provide further clean replays.
- `verify-agent.log`, `verify-security.log`, `verify-db.log`: literal official aliases. Existing live-observability test is conditionally skipped in the core local suite; full/CI execute their configured integration checks.
- `verify-ui.log`, `verify-full.log`: both literal aliases passed. Failures and permanent protection are recorded through failure logs.
- `agent-eval.json`: diff-based scope/security/Harness evaluation.

## Visual inspection

Workspace desktop, cohort Agenda desktop/tablet/mobile and Admin cohort desktop screenshots are included. Existing UI primitives are reused. Mobile Agenda and desktop Admin screens were inspected for layout and readability; responsive/a11y tests retain strict assertions. Login/Aulas baselines and visual thresholds are unchanged. Three stale Windows Home images were synchronized to the already approved P21 main UI: Windows last changed in f086e31, Linux promotion in a4def7c; Home implementation and styles have no diff against main 94b574b. This corrects platform evidence without changing product visuals. Main had only Linux Progress references; three inspected first Windows images complete the 24-image platform matrix now required by verify-ui. Updated screenshots are copied after the final browser run.

## Risks and limitations

Production legacy CANCELLED rows without timestamps require evidence-based reconciliation before migration. Privileged corrections must follow the documented lock protocol. Agenda eligibility may become stale, so commands revalidate. P21.4–P21.7 and P22/provider choices remain outside scope. No remote production migration or merge is performed.

Status: done / verified:true. All required local gates passed. PR #30 is prepared for review. CI on 775845a passed; the user waived waiting for final CI. See verification.json for verified source commit, exact checks and CI evidence.
