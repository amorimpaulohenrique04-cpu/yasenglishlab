# Prompt 19 — Assessment Engine V1 evidence

Status: in_progress / not verified

Baseline: `main@af0857d79345db9ed02f8624868c6b061cc71d0f`  
Branch: `feat/p19-assessment-engine-v1`

## Discovery

- Existing Assessment tables, version/item immutability triggers and response-version guard were confirmed and will be reused.
- Existing authenticated grants expose full rows of `assessment_versions` and `assessment_items`; P19 must narrow these grants so Student access cannot read `scoring_config`, `answer_key` or `rubric`.
- Practice V1 is the structural reference for server-only adapters, authenticated RPCs, durable idempotency and manual-pending behavior.
- No contracted user-facing Assessment route exists in the current repository; P19 therefore remains an engine/application/database task and does not invent Progress UI.
- Standard setting, retake policy, Speaking/Pronunciation evaluation and Assessment Authoring remain open in `docs/OPEN_QUESTIONS.md`.

## Verification

Pending implementation and Official CI. No command/check is recorded as PASS until system evidence is inspected.
