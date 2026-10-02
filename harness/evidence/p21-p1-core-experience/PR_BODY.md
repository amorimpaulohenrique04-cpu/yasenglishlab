Este draft adiciona operações de sessões/disponibilidade e Join autorizado, áudio privado/revisão pedagógica e a infraestrutura de vídeo gravado Mux com LessonProgress. A execução foi encerrada a pedido do usuário para preservar créditos; os três loops ainda não foram verificados integralmente.

Base obrigatória: 78c4c689b6fbabde56083b417e7bbbfc9e302ccb. Migrations aditivas; nenhuma migration histórica editada.

Validação observada: dois replays locais, SQL integration/RLS, concorrência real de Agenda/quota/cancelamento/overlap/review/webhook, 90 unit e 57 integration, build, lint/typecheck e verificadores estruturais de Harness/security/DB passaram nas versões registradas. O último ajuste de metadata de áudio ainda requer replay.

Pendências bloqueantes: E2E completos com provider fake, upgrade com dados legados, matriz Data API/revogação/token expirado, visual/a11y, telemetria e lifecycle de ingest, ratchet, verify:agent/verify:ui/verify:full e Official CI. O eval final reprovou escopo de playwright.config.ts e a exigência de alteração em rls_permissions.sql; a cobertura nova está em p21_core_experience.sql. Smoke Mux real não executado.

Registry permanece in_progress e verified:false. Relatório e logs: harness/evidence/p21-p1-core-experience/REPORT.md. Não está pronto para merge.
