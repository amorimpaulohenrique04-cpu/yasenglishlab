# Domain modules

Business rules are organized by domain, not by technical file type.

Current domain contract surface:

- `domain/` — shared entity schemas, types and entitlement primitives introduced by PROMPT 05.

Expected feature modules remain:

- auth
- dashboard
- courses
- lessons
- practice
- materials
- progress
- assessments
- schedule
- teachers
- billing
- profile
- notifications

## Convention

A feature domain may contain application services, queries, actions and adapters only when real behavior exists. Do not create every directory in advance. Presentation and infrastructure dependencies point inward through explicit contracts.

PROMPT 05 adds contracts and persistence invariants only; it does not implement product UI or full authorization.
