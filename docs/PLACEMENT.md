# Enrollment Core / Placement V1

Placement orchestrates Commercial, Assessment and Cohorts; it does not copy their source records. Entry requires an existing ACTIVE subscription within its confirmed period (TRIALING is not payment confirmation). Local fixtures use the existing synthetic Commercial provider, never a new billing integration.

One initial case per Student references the confirmed subscription and a single Assessment attempt. No automatic second attempt or retake policy is introduced. Existing engine RPCs score objective evidence; Placement never writes `result_cefr` or cut scores.

The operational learning track is a published active **Course**, identified by UUID/title. This is a routing contract, not a validated pedagogical taxonomy or official CEFR level. Teacher selects it from durable courses, supplies feedback and qualitative confidence, and is recorded as provenance. A finalized review is immutable; identical retry returns it, conflicting retry fails. Teacher requires TEACHER+AAL2 and existing assignment/cohort scope; Admin cannot impersonate Teacher review.

`cohort_placement_settings` is the authoritative recurring weekly schedule for matching, in the cohort's existing IANA timezone, plus capacity (1–6). It is not inferred from LiveSessions. LiveSessions remain individual occurrences. V1 availability is a weekly weekday/minute window in the same IANA timezone; every scheduled cohort window must fit a Student preference. Cross-timezone conversion and overnight windows are not silently inferred. Admin configures settings before offering a cohort; no schedule means no candidate. Settings cannot change once memberships exist; capacity can only change without undercutting occupancy.

Self-service matches exactly the recommended Course, active/published Course and active current Cohort, all schedule windows and free capacity. Sort by cohort start then UUID. No AI, cross-track policy, inferred eligibility or plan-name checks. Backend repeats validation under cohort lock. Membership insert trigger shares the lock/capacity invariant with existing Admin commands, including writers outside Placement.

Recommendation (immutable review), initial Student choice (immutable decision) and current membership (case reference) remain separate. Admin+AAL2 may transfer an enrolled Student to a compatible active/published Course cohort with capacity, preserving review/choice/history, requiring a reason and stable operation UUID. Transfers acquire old/new cohort locks in UUID order; conflicting retries fail. Enrollment is created only at final choice, so track content is not granted during review.

Case states: PAYMENT_CONFIRMED → ASSESSMENT_REQUIRED → IN_PROGRESS → REVIEW_PENDING → PLACEMENT_READY → STUDENT_DECISION → ENROLLED. The engine's completion trigger enters review even for fully objective attempts; no CEFR inference. Viewing options explicitly enters STUDENT_DECISION through a command. Case transitions are narrow, audited and validated. Home only projects pending case state. Admin queue composes safe Assessment summary, review, choice and membership; billing fields are absent.

No notification delivery, billing provider, CEFR standard setting, retake policy or unrelated operation is added. OPEN_QUESTIONS remains binding.
