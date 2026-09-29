# Domain modules

Business rules will be organized by domain, not by technical file type.

Expected domains:
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
A domain may later contain its own application services, schemas, queries, actions, types and tests. Do not create every directory in advance. Add a domain when real behavior exists, and keep UI/infrastructure dependencies pointing inward through explicit interfaces.

PROMPT 02 intentionally implements none of these product domains.
