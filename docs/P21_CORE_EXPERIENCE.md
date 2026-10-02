# P21.4–P21.6 core experience

## Live operations

See [Provider-neutral Live Operations and Meeting Access](adr/0012-provider-neutral-live-operations.md). Teacher commands derive the active Teacher from `auth.uid()` and require TEACHER+AAL2. Extra staff roles never expand command scope. Core Class maps to `weekly_core_classes`, Conversation Lab to `weekly_conversation_labs`, and Private Session to `monthly_private_sessions`.

Groups require an active authorized cohort and capacity 1–6. Private requires an authorized target Student, no cohort and capacity 1. Legacy Private sessions without a target cannot accept new bookings. Operators must reconcile these individually from documented evidence; no migration infers a recipient. Booking UUIDs, quota snapshots and existing cancellation commands remain authoritative.

Availability uses explicit half-open intervals. Commands serialize on the Teacher row; adjacent sessions are allowed and overlaps rejected. Any booking history freezes structural fields, including end time, capacity and target. Change time by cancellation and a new session. Title and meeting metadata remain editable.

`private.live_join_policy` is the server-side window configuration, initially 900 seconds before start and after end. Join exposes NOT_AUTHORIZED, TOO_EARLY, MEETING_NOT_READY, AVAILABLE or SESSION_CLOSED. Only AVAILABLE exposes the meeting URL. Student requires their own BOOKED booking and SCHEDULED session; owner Teacher requires AAL2. Manual external meetings use HTTPS without embedded credentials, at most 2,048 characters. General SQL grants and DTOs omit meeting metadata.

Domain triggers persist notifications in the transaction. Event keys include recipient, entity, event and transition revision. An unchanged retry produces no transition; cancellation followed by rebooking increments the booking revision and creates another confirmation. No delivery channel is implemented.

## Pedagogy

See [Human Review V1](adr/0010-human-practice-review-v1.md). The queue revalidates active assignment/cohort scope and orders PENDING_MANUAL by submission and ID. MANUAL_AUDIO is explicit for Speaking/Pronunciation; MANUAL_TEXT remains supported.

`yas-practice-responses` is private, limited to 25 MiB and audio/webm, audio/ogg, audio/mpeg, audio/mp4 and audio/wav. Browser supplies media IDs, never storage paths. Server reserves a unique path and signs an upload without overwrite. Database checks actual Storage metadata before READY and submission. Playback signs for five minutes only after ownership or current Teacher scope is checked. Upload completion and pending review are separate states.

Finalization locks the attempt and writes review, MANUAL_REVIEWED result, notification and audit atomically. Identical reviewer/payload retries return the same review; conflicting finalization fails. Rubric v1 uses categorical levels and mandatory feedback, with null score/max_score and no CEFR conversion. Notes are visible only to their author while active Student scope remains. Session resources/homework require an own BOOKED booking and destination-domain authorization; homework reuses Practice rather than introducing grading.

## Recorded video

See [Mux recorded video](adr/0011-mux-recorded-course-video.md). One VIDEO per Lesson V1 is enforced independently of publication. Migration fails on duplicates rather than changing historical content. Other assets retain ordered publication and protected file access.

Admin+AAL2 creates a VIDEO DRAFT. Direct Upload goes to Mux; the server stores IDs and processing state. READY with a signed playback ID is required for publication. Webhooks use the official SDK against the raw body, durable event keys, row locks and current upload/asset correlation. Recoverable out-of-order events remain PENDING and return 503 for provider retry. READY never regresses to a processing error. Caption processing has its own state and does not block video READY; default language is en.

Playback authorization reuses LessonAsset access. Separate video, thumbnail and storyboard JWTs last duration +15 minutes, capped at four hours. Renewal repeats authorization. Client checkpoints every 15 seconds, pause, hidden document and end into existing LessonProgress. Coalesced writes and database monotonicity protect late responses. Resume requires a finite position within duration. Seek updates resume position but is never counted as watched time. Completion uses the existing progress command.

## Operations and verification

Server-only configuration: MUX_TOKEN_ID, MUX_TOKEN_SECRET, MUX_SIGNING_KEY_ID, MUX_SIGNING_PRIVATE_KEY_BASE64 and MUX_WEBHOOK_SECRET. Use signed playback policies and register `/api/webhooks/mux`. Never put these values in NEXT_PUBLIC variables or evidence. CI uses synthetic events/provider contracts and does not call Mux or spend credits.

Real Mux smoke requires non-production credentials: create an Admin draft, upload a short owned video, observe authenticated webhook ledger and READY, publish, verify authorized playback/captions and renewal, verify denied access after revocation, then remove the test content/provider asset. Record IDs/status/timestamps only; omit media, URLs, tokens and feedback. Without these credentials/evidence, real provider validation remains unverified.

Evidence lives in `harness/evidence/p21-p1-core-experience/`. Acceptance requires SQL/RLS, concurrency, clean replays, legacy upgrade, E2E, accessibility, reviewed screenshots and all official gates; implementation alone never implies verified:true.
