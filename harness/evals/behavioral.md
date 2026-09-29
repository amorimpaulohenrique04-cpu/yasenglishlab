# Behavioral Evals

Run this rubric before an agent concludes a task. Each applicable row is pass/fail; a failure blocks a success claim until corrected or explicitly recorded as a blocker.

| Eval                                   | Pass condition                                                                                                                   | Evidence                                 |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Consulted required documentation?      | The goal lists relevant docs and the implementation follows their contracts.                                                     | GOAL context + changed files.            |
| Ran verification before concluding?    | Every mandatory command in the goal completed successfully.                                                                      | Command/CI output.                       |
| Visual change has evidence?            | Any intentional visual change has inspected screenshot/diff evidence and references the approved UI contract.                    | `harness/evidence/` or PR artifact/link. |
| Created a duplicate component?         | No new primitive duplicates an existing component with the same semantic job.                                                    | Component search/review.                 |
| Touched files outside scope?           | Changed files are inside the declared allowed scope, or the goal/decision log records the justified expansion before conclusion. | Git diff + GOAL.                         |
| Changed security without tests?        | Auth/RLS/secret/security changes have negative tests or deterministic security verification appropriate to the risk.             | Tests + `verify:security`.               |
| Real state matches final report?       | Repository/CI/feature registry state supports every completion claim.                                                            | Git status/CI + `feature_list.json`.     |
| Left critical TODO unregistered?       | Critical TODO/blocker is fixed or recorded in failure log/feature registry with owner/next action.                               | Failure log + registry.                  |
| Declared success despite failing test? | No required check is red/skipped without an explicitly accepted blocker.                                                         | Verification output.                     |

## Evaluation rule

A report is trustworthy only when **all applicable checks pass**. If a check cannot be evaluated, record why in `harness/failure-log/` rather than silently treating it as pass.
