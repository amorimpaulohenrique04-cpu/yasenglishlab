# Admin Content V1 — publication contract blocker

Classification: context  
Status: resolved
Repeatable: no  
Date: 2026-10-01  
PR/commit related: current change — prompt-18-admin-content-v1

## Symptom

Admin Content publication cannot be implemented without a required product decision.

## Evidence

docs/OPEN_QUESTIONS.md leaves pedagogical review before publishing lesson/material/practice open. active governs availability; modules/lessons/assets lack individual editorial states. No durable contract defines direct ADMIN publication while review remains unresolved.

## Root cause

The durable V1 publication contract is not defined. This is an unresolved product contract, not a runtime defect.

## Responsible layer

Product contract and pedagogical publication authority.

## Immediate fix

Impact: cannot implement the requested draft/preview/publication boundary independently or safely edit visible Student content without deciding the contract. No runtime/schema/policy changes.

Required resolution: explicit V1 publication/visibility decision, including direct ADMIN publication authority and edits of published content. No workflow or pedagogical criterion inferred.

## Permanent protection

None — a task-specific unresolved product decision; no repeatable implementation defect is being resolved.

## Test/eval created

None — no implementation fix or contract decision has been made. Existing Harness verifies blocked/unverified state.

## Reproduction

Compare docs/OPEN_QUESTIONS.md with existing learning schema and Student consumers: publication/review remains open and lessons lack editorial states.

## Before/after proof

Before: publication authority and draft visibility are undefined. After: still undefined; runtime preserved and registry blocked/unverified. No resolution claimed.

Historical discovery above is retained. Resolution: the follow-up product-owner request explicitly authorizes ADMIN+AAL2 direct publication in V1, separate DRAFT/PUBLISHED state, unpublish-before-edit and no approval workflow. ADR 0006 and docs/ADMIN_CONTENT.md record the supplied decision. P18 is now in_progress and unverified until implementation evidence passes.

Tracking: harness/goals/prompt-18-admin-content-v1.md; harness/evidence/prompt-18-admin-content-v1/README.md. Registry: in_progress, verified false until the required verification evidence is complete.
