# Go-live checklist

Merging PR 1 and PR 2 does **not** approve a production launch. Status values: `DONE` (evidence in the repo),
`NOT_RUN_EXTERNAL` (needs an account, secret or environment that is not available here), `BLOCKED` (needs a
decision), `NOT_RUN` (can be run, was not).

## Decisions still open (block go-live)

| Item | Status |
|---|---|
| Hosting provider, production environment, staging | BLOCKED (items 27–29) |
| Deploy pipeline (`.github/workflows/release.yml` does not publish the app) | BLOCKED |
| External e-mail provider and production cron (`notifications-cron.yml` has no production URL/secrets; do not point it at a development URL) | BLOCKED |
| Production backups and a **verified restore** | BLOCKED — go-live must not be approved without it |
| Support channel (e-mail/WhatsApp/URL) — the in-app ticket flow works meanwhile, no contact is invented | BLOCKED |
| Terms and Privacy texts approved by the owner (`publish_legal_document` is ready; nothing is seeded) | BLOCKED |
| Data retention periods and deletion rules (inventory below) | BLOCKED |
| Minors / guardian consent | BLOCKED |
| Plan change policy (upgrade/downgrade, pro-rata) and what "apply a request" means | BLOCKED |
| PIX modality (card recurrent × monthly PIX × PIX Automático) | BLOCKED |

## Asaas sandbox script (run last, with real sandbox credentials)

Every row is `NOT_RUN_EXTERNAL`. Record evidence under `harness/evidence/`; never paste customer or card data.

1. Card checkout (hosted) → webhook → subscription `ACTIVE`, placement case created once.
2. Duplicate webhook delivery (same event id) → one effect.
3. Late/out-of-order webhooks (older event after newer) → `STALE`, no regression of access.
4. Overdue charge → `PAST_DUE`; `/profile` lists the charge with a provider link; paying it restores access only after the confirmation event.
5. Renewal → new cycle confirmed, no duplicate cycle.
6. Cancel at period end → access until the paid period; provider subscription removed; 404 on an already removed subscription is treated as success.
7. Reconciliation run (`/admin/billing`): confirm the `GET /v3/subscriptions/{id}` and `/payments?status=` shapes match `AsaasBillingProvider`; a manually deleted subscription raises `PROVIDER_ENDED_LOCAL_ACTIVE`.
8. Refund / chargeback → access removed per event rules.
9. Plan change request: nothing is charged and `plan_id` stays until the policy exists.
10. PIX: only after the modality decision; pending PIX must never activate a subscription.
11. Confirm the account clock/time zone used by `dateCreated`.

## Other external checks

| Check | Status |
|---|---|
| Mux: upload → READY → signed playback → token expiry → denial (`docs/VIDEO_HOMOLOGATION.md`) | NOT_RUN_EXTERNAL |
| Google Meet: Teacher enables host admission; link reveal window verified with real accounts | NOT_RUN_EXTERNAL |
| Staff MFA recovery drill (`docs/MFA_RECOVERY.md`) | NOT_RUN |
| Performance with realistic volume (placement queue 100+, feedbacks, Home, concurrent bookings) — indexes exist for the queue and notifications; no load test was run | NOT_RUN |
| Backup restore rehearsal | BLOCKED |
| Pilot with real users | NOT_RUN |
| Monitoring/alerts outside the Admin panel (the panel at `/admin/ocorrencias` is the only channel today) | BLOCKED |

## Data inventory (for retention decisions — no deletion rule is implemented)

| Data | Where | Notes |
|---|---|---|
| Account, profile, roles | `auth.users`, `profiles`, `user_roles` | Required while the account exists |
| Enrollment, progress, placement cases/reviews, reassessment requests | `enrollments`, `lesson_progress`, `welcome_lesson_progress`, `placement_*`, `reassessment_requests` | Pedagogic history; reviews are append-only |
| Practice answers, audio, manual reviews | `practice_*`, private storage | Audio is personal data; retention period undecided |
| Assessment attempts and scores | `assessment_*`, `skill_scores` | Course progress is not CEFR |
| Subscriptions, billing events, reconciliation findings, plan change requests | `subscriptions`, `billing_*`, `plan_change_requests` | Financial/fiscal records must **not** be deleted by a privacy routine |
| Notifications and delivery attempts | `notifications`, `notification_deliveries` | |
| Support tickets | `support_tickets` | |
| Consent records | `user_consents` linked to immutable `legal_documents` | Must outlive the account for proof |
| Audit log | `audit_logs` | Append-only; carries identifiers, not contact data |
| CRM leads | `crm_leads`, `crm_interactions`, `crm_tasks` | Contact data; consent not modeled |

Access/export/anonymisation routines are **not** implemented: they need an approved policy and a restore test first.
