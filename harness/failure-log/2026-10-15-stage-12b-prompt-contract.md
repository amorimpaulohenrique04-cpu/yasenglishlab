# Failure — authored assessment prompt must execute for Student

Classification: test gap  
Status: resolved  
Repeatable: yes  
Date: 2026-10-15  
PR/commit related: current change, stage-12-lacunas-operacionais

## Symptom

A published Admin-authored entry assessment failed to render for the Student after starting the attempt.

## Evidence

Real browser run, 2026-10-15 17:38 UTC: SupabaseAssessmentRepository.getExecution rejected items[0].prompt.instructions as unrecognized. Admin publication alone passed and did not prove Student execution.

## Root cause

New editor always serialized an instructions field, including empty strings on MULTIPLE_CHOICE. Existing Student multipleChoicePromptSchema is strict and does not accept instructions. Empty instructions are also invalid for the manual prompt schema.

## Responsible layer

Assessment authoring input/UI boundary.

## Immediate fix

Serialize objective prompts as prompt/options only. Show optional instructions only for human response questions and omit empty instructions. Reuse the existing Student prompt schemas when validating Admin input.

## Permanent protection

Admin input validation calls the canonical executable prompt schema for the selected item type; incompatible payloads fail before RPC publication. No relaxation of Student validation or access checks.

## Test/eval created

 tests/unit/admin-assessments.test.ts asserts both objective and manual authored prompts pass canonical Student schemas and objective instructions are rejected. tests/e2e/admin-assessments.spec.ts publishes version 2 and starts it through the ordinary Student onboarding, checking the visible authored prompt and persisted assessment_version_id.

## Reproduction

Publish an objective prompt with instructions under the previous editor, then start it as a newly subscribed Student. The strict execution read fails before rendering the question.

## Before/after proof

Before: real browser ZodError unrecognized_keys instructions, no question shown.

After: targeted domain tests pass; browser subsequently passed the complete B flow (1.6 min, including Student execution and forbidden Admin access). Full Vitest 544 passed, 1 skipped.
