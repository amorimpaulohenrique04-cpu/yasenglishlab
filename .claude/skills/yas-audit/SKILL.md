---
name: yas-audit
description: Perform a product-to-code Yas English Lab gap audit in read-only mode with concise evidence and prioritization.
argument-hint: "[domínio / jornada / escopo]"
disable-model-invocation: true
---
Audit scope: $ARGUMENTS

Read-only diagnostic. Compare actual branch with `docs/PRODUCT.md`, affected docs, `docs/ROADMAP.md`, `docs/OPEN_QUESTIONS.md` and Harness feature/evidence registry. Use `yas-auditor`, optionally `yas-scout` for a targeted preliminary index. No broad exploration unless explicit. Do not use incomplete historic conversations as current state. Trace high-risk paths Student/Teacher/Admin as relevant. Deliver short risk-ordered table: category, concrete impact, evidence file:line, missing behavioral test, smallest proposed correction, confidence. No code changes, provider interactions, DB resets or commits.
