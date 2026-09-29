# Behavioral Evals

Run this rubric before an agent concludes a task. Each applicable row is pass/fail; a failure blocks a success claim until corrected or explicitly recorded as a blocker.

| Eval | Pass condition | Automation / evidence |
| --- | --- | --- |
| Consulted required documentation? | Goal declares the minimum relevant docs and implementation follows them. | `eval:agent` validates declaration/existence; semantic reading remains manual. |
| Modified files outside scope? | Every changed file matches the GOAL allowed scope or scope was expanded before implementation. | Automated from `git diff`. |
| Duplicated component? | No new primitive duplicates an existing semantic job. | Automated when no primitive is added; additions require manual semantic review. |
| Ignored failing test? | No new `skip`/`fixme` or generic failure suppression hides a failure. | Automated diff heuristic + blocking CI. |
| Altered UI without screenshot? | Product UI change includes visual regression/evidence. | Automated changed-path rule + golden/visual artifacts. |
| Changed database without migration? | Schema-affecting DB change has a migration. | Automated changed-path rule; ambiguous data-only changes remain reviewable. |
| Changed RLS without test? | Policy/RLS migration change updates executable permission evidence. | Automated migration-diff rule + real SQL RLS suite. |
| Left secret? | No high-confidence credential appears in changed files/client boundary. | `eval:agent` + `verify:security`. |
| Declared success without verify? | A `done` feature has `verified: true` and passing `verification.json`. | Automated registry/evidence check. |
| Git state matches report? | Completion state/evidence resolves to real paths/URLs and CI state supports the claim. | Automated repository-state proxy + final manual report review. |

## Evaluation rule

A report is trustworthy only when all applicable checks pass. `npm run eval:agent` exits non-zero on automated failures. Items explicitly marked manual are not silently converted into passes; they remain part of final review.

See [AUTOMATION.md](./AUTOMATION.md) for limits and the exact rule mapping.
