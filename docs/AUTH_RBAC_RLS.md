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
- **SUPPORT:** contexto mínimo de atendimento; não recebe payload privilegiado de billing.
- **ADMIN:** operações administrativas explícitas e auditáveis.

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
- Recording: booking válido + entitlement; ou professor da sessão/admin.
- BillingEvent: apenas ADMIN AAL2 e sem exposição da coluna `payload` pelo Data API.
- AuditLog: apenas ADMIN AAL2 para leitura.
- Notification/favorite: ownership pelo `auth.uid()`.

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
