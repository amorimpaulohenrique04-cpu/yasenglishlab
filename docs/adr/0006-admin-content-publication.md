# ADR 0006 — Admin Content V1 publication

## Status

accepted

## Date

2026-10-01

## Context

P18 discovery stopped at an unresolved pedagogical-review decision. The product owner explicitly resolved the V1 decision in the follow-up request; the historical blocker remains recorded.

## Decision

ADMIN with durable role and AAL2 publishes/unpublishes directly in V1. No mandatory pedagogical approval, reviewer or multi-stage workflow exists. The existing six content entities gain separate DRAFT/PUBLISHED publication_status and published_at; active retains operational availability. New rows start DRAFT; valid existing content is backfilled PUBLISHED. Published structural/content edits require unpublish first; no editorial versioning. Student visibility requires the published ancestor chain plus existing enrollment/entitlement/availability. Preview requires ADMIN+AAL2 and never changes publication. Narrow authenticated RPC commands derive the actor, validate publication and write audit in the same transaction. Reorder is atomic within one parent for modules/lessons/assets only.

## Alternatives

Using active as publication conflates separate contracts. Review queues and staging/version tables are explicitly out of V1 scope. Browser-only checks cannot enforce direct Data API/RPC access.

## Consequences

Unpublish temporarily removes content from Student consumption while Admin edits. Published descendants remain unchanged when an ancestor is unpublished. Future review/versioning requires a new explicit decision. Binary upload is out of scope; unsupported creation requiring upload is unavailable without blocking metadata/TEXT/LINK operations.
