# ADR 0011 — Mux recorded course video

Accepted — 2026-10-02.

Mux is the recorded course video provider behind VideoProviderPort. LessonAsset VIDEO remains pedagogical truth; lesson_video_assets stores private provider lifecycle. Admin+AAL2 creates direct uploads; signed webhooks update state idempotently. Publication requires READY. Student access reuses can_read_lesson_asset before issuing finite playback, thumbnail and storyboard tokens.

V1 permits one VIDEO per Lesson, with TEXT and other ordered assets. LessonProgress remains the only progress/resume record. Position is monotonic and never proves watched time. Captions default to en, are configurable and do not block READY playback while processing. Missing captions remain visible to operators; accessibility review requires captions appropriate to the content. Live session recordings remain separate.
