# CRM Leads V1

The local CRM is a bounded operational record for prospective contacts, not an identity or billing system.

## Lead lifecycle

Stages are `NEW`, `CONTACTED`, `QUALIFIED`, `WON`, and `LOST`. V1 permits forward transitions and loss from an active stage; `WON` and `LOST` are terminal. Temperature (`COLD`, `WARM`, `HOT`) is descriptive and never grants access. A lead needs an email or phone and a source. Estimated value is optional and is not recognized revenue.

A linked user is an already-existing `STUDENT` identity. Creating, winning, or linking a Lead never creates Auth, profile, role, subscription, enrollment, or Placement state. Consent is not modeled because no consent source or policy has been established; the system must not infer it.

## Access and privacy

`/admin/leads` and its database RPCs independently require `ADMIN+AAL2`. CRM tables have RLS enabled and no direct `anon` or `authenticated` table grants. Read access uses a bounded Admin RPC (at most 50 leads per page, 20 tasks and 20 interactions per Lead); mutations validate owner roles and identity links in PostgreSQL. Owners may be `ADMIN` or `SUPPORT`; Teacher receives no CRM access.

Critical operations emit append-only audit facts with identifiers and operation metadata only. Audit and application logs must not copy contact details, interaction summaries, or other unnecessary PII. No external delivery or billing provider is implied.
