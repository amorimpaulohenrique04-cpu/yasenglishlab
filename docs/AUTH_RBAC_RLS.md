# Authentication, RBAC & RLS

## Propósito

Separar autenticação (“quem é?”) de autorização (“o que pode fazer?”) e manter a regra válida mesmo quando o navegador é malicioso ou chama Supabase diretamente.

## Implementação

Autenticação usa Supabase Auth com sessão SSR por cookies via `@supabase/ssr`.

Fluxos implementados:

- `/login`: e-mail + senha;
- `/forgot-password`: recuperação sem enumeração visível de contas;
- `/auth/callback`: troca segura do PKCE code por sessão;
- `/reset-password`: atualização de senha após sessão de recovery;
- `/profile`: rota protegida e atualização somente do próprio perfil;
- `/mfa`: enrollment/challenge TOTP.

O root `proxy.ts` renova a sessão e usa `auth.getClaims()` para verificar identidade. Server Components e Server Actions resolvem novamente o contexto antes de operações protegidas.

## Roles

- **STUDENT:** próprios dados, matrícula/progresso visível, materiais permitidos, bookings e resultados.
- **TEACHER:** sessões próprias e somente alunos com uma `teacher_student_assignment` ativa.
- **SUPPORT:** contexto mínimo de atendimento e assinatura; não recebe histórico pedagógico por padrão nem payload privilegiado de billing.
- **ADMIN:** operações administrativas explícitas e auditáveis.
- Admin Content uses ADMIN+AAL2 at both server and authenticated Postgres RPC boundaries. Direct authenticated content DML remains denied. Only ADMIN+AAL2 may preview drafts; Teacher/Support have no editorial grant. Student RLS and consumption RPCs enforce published ancestors plus existing enrollment/entitlement/availability. See [ADMIN_CONTENT.md](./ADMIN_CONTENT.md).

Roles são lidas de `public.user_roles` no servidor. `user_metadata`, query string, formulário e JavaScript do browser nunca são autoridade para role.

## MFA para staff

TEACHER, SUPPORT e ADMIN exigem **AAL2** para dados e operações privilegiadas.

Uma sessão AAL1 pode ler apenas o mínimo necessário para descobrir a própria role e concluir MFA. Policies RLS e guards server-side verificam AAL2, portanto esconder ou mostrar uma tela não altera a permissão real.

O procedimento operacional de recuperação/break-glass ainda precisa ser definido antes de produção; a exigência runtime de AAL2 para staff já é decisão arquitetural.

## RLS

Todas as tabelas públicas permanecem com RLS habilitado. A migration `20260929043000_auth_rbac_rls.sql` adiciona policies executáveis.

Regras principais:

- Profile: usuário lê/edita somente o próprio perfil; teacher só lê aluno atribuído; support/admin exigem AAL2.
- Progress/attempts/scores: próprio aluno, teacher atribuído ou staff permitido.
- Material/lesson asset pago: enrollment + entitlement; staff pedagógico autorizado.
- Paths internos de Storage não são expostos pelo Data API; o servidor primeiro prova acesso por RLS e só então resolve o path com credencial server-only.
- Recording: booking válido + entitlement; ou professor da sessão/admin.
- BillingEvent: apenas ADMIN AAL2 e sem exposição da coluna `payload` pelo Data API.
- AuditLog: apenas ADMIN AAL2 para leitura.
- Notification/favorite: ownership pelo `auth.uid()`.

## Teacher Operations V1

A área `/teacher` usa `requirePageRole("TEACHER")`; comandos usam `assertRole("TEACHER")`. Ambos preservam a exigência global de MFA para staff.

No banco, `get_teacher_sessions()`, `get_teacher_session_roster(uuid)` e `mark_teacher_attendance(uuid,text)` repetem o boundary: `auth.uid()` não nulo, `private.has_role('TEACHER', true)`, professor ativo e sessão pertencente a esse professor. Nenhuma função recebe teacher/actor como parâmetro.

Isso é intencionalmente mais restrito que policies genéricas de `live_sessions` / `session_bookings`: uma conta TEACHER + ADMIN continua vendo somente o escopo do professor quando usa Teacher Operations.

O roster usa um read model mínimo SECURITY DEFINER para obter apenas o nome de exibição dos participantes da própria sessão sem ampliar `profiles_staff_select`. O acesso pedagógico amplo continua em `private.is_teacher_assigned()` / `private.can_view_student()`.

`authenticated` continua sem INSERT/UPDATE direto em `attendance`. A mutação autorizada aceita apenas ATTENDED/NO_SHOW para booking BOOKED da própria sessão.

## Mutações críticas

O papel `authenticated` **não possui DML direto** para:

- `user_roles`;
- `subscriptions`;
- `plan_entitlements`;
- `lesson_progress`;
- `session_bookings`;
- `billing_events`.

Serviços server-only estabelecem primeiro a identidade/role, depois usam o client privilegiado apenas para o comando autorizado. Por exemplo, booking recebe apenas `liveSessionId`; o `user_id` é derivado da sessão verificada.

## Service role

`SUPABASE_SERVICE_ROLE_KEY` é lida somente por `src/server/env.ts`, e o admin client importa `server-only`. Client Components não podem importar módulos de `@/server/`; isso é verificado no CI.

Service role não substitui autorização. Qualquer nova função que o use deve:

1. verificar identidade;
2. verificar role/entitlement/escopo;
3. derivar ownership do contexto, não do browser;
4. escrever audit trail quando a ação for crítica.

Admin Teachers follows that boundary: the Auth Admin invite and role/Teacher reconciliation run only in server-only code after `assertRole("ADMIN")` enforces staff AAL2. The reconciliation RPC is executable only by `service_role`; it derives the target identity from normalized email, hardcodes the `TEACHER` role, and creates the unique Teacher row idempotently. Authenticated clients cannot call that RPC or write `user_roles`/`teachers` directly. Admin directory, capability, and lifecycle RPCs independently enforce Admin+AAL2.

## Testes obrigatórios

`supabase/tests/rls_permissions.sql` executa contra PostgreSQL real e cobre, entre outros:

- Student A → own progress = allow;
- Student A → Student B progress = deny;
- Teacher X AAL2 → assigned Student A = allow;
- Teacher X → unrelated Student B = deny;
- Teacher AAL1 → student data = deny;
- Support → privileged billing = deny;
- Admin AAL1 → privileged billing = deny;
- Admin AAL2 → billing metadata = allow;
- Anonymous → protected records = deny;
- direct role/entitlement/progress/booking mutation = deny.

CI recria duas bases vazias, reaplica migrations/seeds e executa todos os SQL tests. Nenhuma policy é aceita somente por revisão manual.

## Interfaces

[SECURITY.md](./SECURITY.md) · [THREAT_MODEL.md](./THREAT_MODEL.md) · [DATA_MODEL.md](./DATA_MODEL.md) · [BILLING.md](./BILLING.md) · [TESTING.md](./TESTING.md) · [ADR 0003](./adr/0003-auth-rbac-rls.md)

## Assessment Engine V1

O lifecycle de Assessment usa RPCs autenticadas que derivam o Student de `auth.uid()`; o browser não envia `user_id` como autoridade. Writes diretos de `assessment_attempts`, `assessment_responses` e `skill_scores` permanecem indisponíveis para `authenticated`.

As policies existentes de Attempt/Response/SkillScore continuam usando `private.can_view_student`, preservando owner + staff autorizado. Para conteúdo de Assessment, `authenticated` recebe somente leitura por coluna dos campos necessários à execução. `assessment_versions.scoring_config`, `assessment_items.answer_key` e `assessment_items.rubric` não têm privilégio SELECT autenticado normal.

O scorer executa server-side/database-side; RLS/UI não são usados como mecanismo para esconder gabarito.

## P21 foundation closure

The additive P21.1–P21.3 contracts and verification are documented in [P21 foundation](P21_FOUNDATION.md) and ADRs 0007–0009. The prior domain contracts remain applicable.

## Stage 02 operational projections

Teacher operational context requires `TEACHER+AAL2`, derives the Teacher from `auth.uid()`, and only projects currently assigned cohorts/Students. Cohort roster previews, upcoming sessions, availability, and session collections are bounded. Practice review queue output is capped; a specific attempt remains subject to the same current assignment check. Teacher Student detail composes existing RLS-protected enrollment, curriculum, Practice, scored Assessment, Attendance, Placement, note, booking, and own-session homework records; it is not an administrative projection and never reads CRM or commercial data.

CRM tables have RLS enabled and no direct table grants to `anon` or `authenticated`. `admin_crm_directory` and `admin_crm_mutate` repeat `ADMIN+AAL2` at the database boundary. Owner assignment accepts only existing Admin/Support identities, and linking accepts only an existing Student identity. No CRM operation creates Auth users or mutates roles, enrollment, subscription, or Placement. See [CRM Leads V1](./CRM.md).

