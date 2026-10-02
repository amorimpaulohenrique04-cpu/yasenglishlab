# ADR 0010 — Human Practice Review V1

Accepted — 2026-10-02.

Speaking and Pronunciation use human Teacher review. MANUAL_TEXT remains compatible; MANUAL_AUDIO is private Storage media linked to an owned attempt. Review v1 has one final review per attempt and categorical dimensions, never aggregate score or CEFR inference. practice_manual_reviews is review truth; practice_results is the Student-facing projection, updated transactionally with feedback notification. Reviewer scope and AAL2 are rechecked in PostgreSQL. Internal Teacher notes are separate from Student feedback.
