# Data Model & Domain Contracts

## Propósito

Formalizar o domínio do Yas English Lab antes das features de produto para que UI, serviços e integrações não inventem modelos incompatíveis. PostgreSQL/Supabase é o sistema de registro durável; Zod/TypeScript valida fronteiras da aplicação.

Implementação inicial:
- migration: `supabase/migrations/20260929035100_create_domain_contracts.sql`;
- seed: `supabase/seed.sql`;
- contratos: `src/modules/domain/`;
- invariantes executáveis: `tests/unit/domain-contracts.test.ts` e `supabase/tests/domain_invariants.sql`.

## Mapa de entidades

### Identity
- **User** → `auth.users` (Supabase Auth; não duplicamos uma tabela `users` pública).
- **Profile** → dados de apresentação do usuário.
- **Role** → `user_roles`; STUDENT, TEACHER, SUPPORT, ADMIN.

### Commercial
- **Plan** → produto comercial configurável.
- **Entitlement** → capacidade mensurável liberada ao usuário.
- **PlanEntitlement** → valor/cadência do entitlement por plano, com vigência.
- **Subscription** → espelho local do estado confirmado pelo provider.
- **BillingEvent** → evento externo idempotente, identificado por `provider + event_id`.

### Learning
- P18 adds `publication_status` (DRAFT/PUBLISHED) and `published_at` to courses, modules, lessons, lesson_assets, materials and practice_activities. `active` remains availability. New rows default DRAFT; valid pre-existing rows are backfilled PUBLISHED. Publication/visibility and unpublish-before-edit follow [ADMIN_CONTENT.md](./ADMIN_CONTENT.md), without parallel content tables or editorial versions.
- **Course → Module → Lesson → LessonAsset**.
- **Enrollment** liga User a Course.
- **LessonProgress** liga User/Enrollment a Lesson e mede somente avanço curricular. Na canonical slice persiste `completion_percent`, `last_position_seconds`, `last_accessed_at` e `completed_at` para retomada.
  - `completion_percent` e `last_position_seconds` são monotônicos: retry ou checkpoint atrasado não pode reduzir conclusão nem mover a retomada para trás.
  - a unicidade por `user_id + lesson_id` mantém uma única linha idempotente por aluno/aula.

### Practice
- **PracticeActivity → PracticeAttempt → PracticeResponse + PracticeResult**.
- Practice pode carregar `cefr_target` como contexto pedagógico, mas seu resultado não define proficiência CEFR.
- `practice_attempts(user_id, idempotency_key)` torna retry de início idempotente; resposta e resultado são únicos por tentativa.
- `practice_results.evaluation_status` distingue resposta objetiva (`CORRECT`/`INCORRECT`) de `PENDING_MANUAL`; pending/manual nunca carrega score inferido.

### Materials
- **Material** pode apontar para Module/Lesson e declarar `required_entitlement_key`.
- **MaterialFavorite** pertence ao usuário e ao material.
- Material protegido deve usar storage privado; URL externa permanente não é aceita para esse caso.

### Assessment
- **Assessment → AssessmentVersion → AssessmentItem**.
- **AssessmentAttempt** aponta diretamente para uma versão publicada.
- **AssessmentResponse** precisa pertencer à mesma versão da tentativa.
- **SkillScore** registra score/CEFR por habilidade com provenance.

### Live
- **Teacher → TeacherAvailability**.
- **TeacherStudentAssignment** limita explicitamente quais alunos um professor pode consultar.
- **LiveSession → SessionBooking → Attendance**.
- **LiveSessionRecording** pertence a uma LiveSession e pode exigir entitlement.
- LiveSession possui capacidade no banco e pode declarar `required_entitlement_key`.

### Platform
- **Notification** → mensagem persistida por usuário.
- **AuditLog** → histórico append-only de ações relevantes.

## Relacionamentos essenciais

```text
auth.users
  ├─ profiles
  ├─ user_roles
  ├─ subscriptions ── plans ── plan_entitlements ── entitlements
  ├─ enrollments ── courses ── modules ── lessons ── lesson_assets
  │                    └──────── lesson_progress (via enrollment + lesson)
  ├─ practice_attempts ── practice_activities ── practice_results
  ├─ material_favorites ── materials
  ├─ assessment_attempts ── assessment_versions ── assessments
  │         ├─ assessment_responses ── assessment_items
  │         └─ skill_scores
  └─ session_bookings ── live_sessions ── teachers
                         └─ attendance (via booking)
```

## Invariantes

1. **Progresso curricular não é proficiência.**
   - `lesson_progress.completion_percent` mede curso/aula; posição/retomada continuam sendo estado curricular, não proficiência.
   - CEFR de resultado existe no domínio de assessment, nunca em `lesson_progress`.

2. **CEFR é resultado de avaliação.**
   - `assessment_attempts.result_cefr` e `skill_scores.cefr_level` exigem uma tentativa ligada a `assessment_version`.
   - `practice_activities.cefr_target` e `assessment_items.cefr_target` são alvos/contexto, não resultado do aluno.

3. **Plano não autoriza feature diretamente.**
   - START/TALK/BOOST são registros em `plans`.
   - autorização funcional resolve `entitlements`; código de UI não deve usar `if (plan === ...)`.

4. **Entitlements são configuráveis e temporais.**
   - `plan_entitlements` guarda valor, cadência e vigência.
   - uma nova regra comercial deve criar nova configuração, não espalhar condicionais.

5. **Sessão ao vivo possui capacidade no banco.**
   - `live_sessions.capacity` é obrigatória.
   - `session_bookings` bloqueia a linha da sessão antes de contar reservas ativas, serializando concorrência e evitando overbooking.
   - private session exige capacidade 1; sessões atuais limitam-se a 6 conforme contrato de produto.

6. **Assessment é versionado e histórico é preservado.**
   - tentativa só nasce contra versão PUBLISHED.
   - versão/item publicado ou usado não pode ser editado silenciosamente.
   - versão publicada pode apenas transicionar para RETIRED sem alterar conteúdo.

7. **Billing é idempotente.**
   - `billing_events(provider, event_id)` é único.
   - identidade, payload e timestamp do evento não podem ser reescritos; somente metadata de processamento pode avançar.

8. **Histórico crítico não é sobrescrito silenciosamente.**
   - AuditLog é append-only.
   - BillingEvent preserva o evento recebido.
   - Assessment versionado preserva interpretação aplicada ao aluno.

## Planos como dados

Seed inicial:

| Plano | Preço/mês | weekly_core_classes | weekly_conversation_labs | monthly_private_sessions |
| --- | ---: | ---: | ---: | ---: |
| START | R$ 99,90 | 1/semana | 0 | 0 |
| TALK | R$ 179,90 | 1/semana | 1/semana | 0 |
| BOOST | R$ 329,90 | 1/semana | 2/semana | 1/mês |

Esses códigos identificam produtos; não são uma enumeração de autorização. Novos planos podem ser adicionados sem mudar os contratos de acesso se reutilizarem os mesmos entitlements.

## Enums e estados

O banco evita PostgreSQL ENUM nesta etapa. Estados estáveis usam `CHECK` constraints, que preservam validação sem tornar evolução de domínio desnecessariamente rígida. TypeScript usa literais/Zod para validar DTOs.

## Segurança e autorização

PROMPT 06 implementa as policies RLS e contratos server-side descritos em [AUTH_RBAC_RLS.md](./AUTH_RBAC_RLS.md).

`teacher_student_assignments` é o sistema de registro da relação que permite ao professor consultar contexto de um aluno. Conhecer um UUID não é suficiente.

`live_session_recordings`, materiais e lesson assets protegidos guardam somente paths privados; a aplicação emite signed URLs curtas após autorização.

Roles, entitlements, subscriptions e bookings não aceitam mutação direta pelo papel `authenticated`. Lesson progress mantém `UPDATE` direto negado; a canonical slice expõe somente `record_lesson_progress`, que deriva `auth.uid()` e valida matrícula antes do upsert.

## Verificação

- `npm run typecheck`;
- `npm test`;
- `npm run verify:db`;
- CI recria duas bases PostgreSQL vazias, aplica migrations e seed em ambas e executa assertions SQL;
- seed é executado duas vezes para provar idempotência básica de desenvolvimento.

## Interfaces

[AUTH_RBAC_RLS.md](./AUTH_RBAC_RLS.md) · [BILLING.md](./BILLING.md) · [CEFR_ASSESSMENT.md](./CEFR_ASSESSMENT.md) · [LIVE_CLASSES.md](./LIVE_CLASSES.md) · [PRACTICE_ENGINE.md](./PRACTICE_ENGINE.md) · [ADR 0002](./adr/0002-domain-contracts.md)


## Teacher Operations V1

Teacher Operations não cria novas entidades. Reutiliza:
- `teachers` como vínculo entre `auth.uid()` e professor ativo;
- `live_sessions.teacher_id` como autoridade de sessão;
- `session_bookings` como roster operacional;
- `attendance` como estado ATTENDED/NO_SHOW, com uma linha por booking;
- `teacher_student_assignments` como autoridade separada para contexto pedagógico amplo.

A migration Teacher V1 adiciona apenas read models/command RPC e audit trigger. Não adiciona grants de DML em `attendance`, não abre `profiles` globalmente e não altera a semântica de booking.
