# Admin Content V1

Product owner decision: ADMIN+AAL2 publishes directly; no pedagogical approval workflow in V1. See ADR 0006. Workflow: DRAFT → PUBLISHED → DRAFT. active remains independent availability. Published content must be unpublished before editing; no versions or shadow tables.

Admin uses the same courses/modules/lessons/lesson_assets/materials/practice_activities consumed by Student. Preview is an authorized read without publication mutation. Student visibility requires publication through the hierarchy and existing entitlement/enrollment rules. Only modules, lessons and assets support manual ordering; reorder is an atomic full permutation within one parent.

Publication validates structural fields and existing practice formats, sources and relationships. Lessons require a published usable asset; no subjective pedagogical requirement is added. Storage references stay server-only; no binary upload service is introduced. New materials requiring a protected binary upload remain unavailable; existing records can be administered.

Sensitive commands derive auth.uid(), require durable ADMIN+AAL2 in Postgres, preserve denied direct authenticated DML and audit create/update/publish/unpublish/reorder transactionally without content bodies or private paths.
