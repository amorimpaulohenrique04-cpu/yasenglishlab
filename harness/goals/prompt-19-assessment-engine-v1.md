# GOAL — prompt-19-assessment-engine-v1: Assessment Engine V1

Status: in_progress  
Owner: agent/human  
Created: 2026-10-01  
Updated: 2026-10-01

## Objective

Deliver the existing Assessment domain as a secure, version-frozen, idempotent and auditable Student engine without inventing CEFR standard setting, Speaking/Pronunciation scoring, retake policy or Assessment Authoring.

## Visible result

An authorized Student can start an attempt against an explicitly selected PUBLISHED AssessmentVersion, record contracted responses, complete or submit the attempt safely, persist only deterministic objective SkillScores, retry start/completion without duplicates, and never receive answer keys, scoring configuration or invented CEFR.

## Relevant context

- `docs/CEFR_ASSESSMENT.md`
- `docs/DATA_MODEL.md`
- `docs/ARCHITECTURE.md`
- `docs/AUTH_RBAC_RLS.md`
- `docs/SECURITY.md`
- `docs/ANALYTICS.md`
- `docs/TESTING.md`
- `docs/DEFINITION_OF_DONE.md`
- `docs/OPEN_QUESTIONS.md`
- Practice V1 application/domain/server slice
- Existing Assessment tables/triggers in historical domain migrations

## Acceptance criteria

- [ ] Start is durable/idempotent, derives `auth.uid()`, and accepts only an authorized PUBLISHED version.
- [ ] Attempt version identity is frozen after creation.
- [ ] Response writes validate ownership, attempt state, item/version identity and the supported item payload contract.
- [ ] Completion is durable/idempotent and never duplicates SkillScores.
- [ ] Only deterministic objective metrics are scored; manual/unsupported evaluation remains pending without zero/fake score.
- [ ] `result_cefr` and `skill_scores.cefr_level` remain NULL and no percentage-to-CEFR mapping exists.
- [ ] Speaking/Pronunciation receive no automatic/AI score.
- [ ] Student cannot read `answer_key`, `rubric` or `scoring_config` through authenticated Data API access.
- [ ] Student isolation and legitimate existing staff read scope remain enforced by RLS.
- [ ] Assessment analytics use the existing ProductAnalyticsPort with stable idempotency keys.
- [ ] Historical migrations remain unchanged and no unrelated behavior regresses.
- [ ] PR is opened against `main` and is not merged.

## Allowed files / domains

- `src/modules/assessments/**`
- `src/server/assessments/**`
- one append-only P19 migration under `supabase/migrations/**`
- Assessment-focused `supabase/tests/**` and `tests/**`
- minimal test-runner/DB verifier wiring needed so P19 SQL evidence is actually executed
- `docs/CEFR_ASSESSMENT.md`, `docs/DATA_MODEL.md`, `docs/AUTH_RBAC_RLS.md`, `docs/ANALYTICS.md` only to synchronize executable P19 contracts
- `harness/**`

## Forbidden areas

- Historical migrations.
- Progress dashboard/UI redesign.
- Assessment CMS/authoring/publication UI.
- Standard setting/cut scores or any percentage-to-CEFR rule.
- Retake policy.
- AI/human/hybrid decision for Speaking/Pronunciation.
- New analytics provider.
- Broad refactors unrelated to Assessment.

## Mandatory tests

- `npm run verify:agent`
- `npm run verify:security`
- `npm run verify:db`
- `npm run verify:full`
- `npm run test:unit`
- `npm run test:integration`
- `npm run test:integration:db`
- `npm run test:rls`
- Assessment-focused unit/application/PostgreSQL tests.
- Existing E2E suite must remain green; no new visual Assessment E2E is required while no Assessment route/UX is contracted.

## Required evidence

- Official CI workflow run and job conclusions for the branch/PR SHA.
- Real PostgreSQL Assessment SQL assertions covering lifecycle, idempotency, immutability and CEFR-null invariants.
- RLS/privilege evidence proving cross-Student isolation and no answer-key/scoring-config exposure.
- Unit/application test evidence for deterministic scoring, pending/manual behavior and analytics keys.
- Durable records under `harness/evidence/prompt-19-assessment-engine-v1/`.

## Definition of done

Done means every acceptance criterion passes, mandatory applicable checks are evidenced green, security/DB evidence was inspected, open pedagogical questions remain unresolved by code, progress/evidence were recorded, and `harness/feature_list.json` reflects the real verified state. A pending or unobserved check is not a pass.
