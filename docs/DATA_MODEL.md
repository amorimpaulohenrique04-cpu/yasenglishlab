# Data Model & Systems of Record

## Propósito
Definir entidades e donos de estado para evitar modelos incompatíveis. Nesta fase é conceitual; migrations virão em tarefa posterior.

## Decisões
Domínios previstos:
- Identity: `profiles`, `user_roles`.
- Commercial: `plans`, `plan_entitlements`, `subscriptions`, `billing_events`.
- Learning: `courses`, `course_levels`, `modules`, `lessons`, `lesson_assets`, `enrollments`, `lesson_progress`.
- Practice: `practice_activities`, `practice_attempts`, `practice_results`.
- Materials: `materials`, `material_favorites`.
- Assessment: `assessments`, `assessment_versions`, `assessment_items`, `assessment_attempts`, `assessment_responses`, `skill_scores`.
- Live: `teachers`, `teacher_availability`, `live_sessions`, `session_bookings`, `attendance`.
- Platform: `notifications`, `audit_logs`.

Sistemas de registro:
- progresso de aula → `lesson_progress`;
- proficiência → assessment version/attempt/skill scores;
- agenda → sessions + bookings + attendance;
- acesso comercial → subscription mirror + entitlements.

## Invariantes
- Progresso de curso e proficiência são entidades distintas.
- Assessment aplicado aponta para versão imutável.
- Histórico relevante não é sobrescrito silenciosamente.
- Eventos de billing são idempotentes/registráveis.
- Capacidade de sessão é regra server/database.
- Home/Progresso UI são projeções.

## O que não fazer
- Campo `progress` genérico para curso e CEFR.
- Representar sessão ao vivo como variante improvisada de lesson.
- Autorizar por string de plano espalhada.
- Modificar avaliação já aplicada sem preservar versão.

## Interfaces
[AUTH_RBAC_RLS.md](./AUTH_RBAC_RLS.md) · [BILLING.md](./BILLING.md) · [CEFR_ASSESSMENT.md](./CEFR_ASSESSMENT.md) · [LIVE_CLASSES.md](./LIVE_CLASSES.md) · [PRACTICE_ENGINE.md](./PRACTICE_ENGINE.md)

## Critérios de aceitação
- Cada fato crítico tem dono único.
- Read models podem ser reconstruídos.
- Relações comerciais/pedagógicas não dependem de strings ad hoc.
