# Plano de implementação — P21 P0 Foundation Closure

Base inspecionada em 2026-10-02: `main`, SHA `94b574b40b8b05ed798f996294d2297ba92b5e31`. `git ls-remote origin refs/heads/main` confirmou o mesmo SHA; checkout inicialmente limpo. P21 já está presente. Branch proposta pelo pedido: `feat/p21-p0-foundation-closure`, criada somente no início da implementação. Nenhuma branch, feature ou migration foi criada nesta etapa.

Este documento planeja uma iniciativa com três checkpoints: P21.1 Role Router & Portal Entry; P21.2 Commercial Usage Contract; P21.3 Cohorts / Turmas V1. Evidências históricas do Harness foram consultadas como contexto, sem tratar seus resultados como execução atual dos gates.

## 1. Mapa do estado real

| Domínio            | Implementação atual                                                                                                                                               | Consequência para a entrega                                                                                  |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Auth               | `src/server/auth/context.ts` verifica `getClaims()` e lê roles de `user_roles`; login usa fallback `/home`                                                        | Reutilizar contexto; introduzir resolver de destino server-side                                              |
| MFA                | `staffMfaRequired` inclui TEACHER, SUPPORT e ADMIN; login encaminha para `/mfa?next=...`; MFA navega para next sanitizado                                         | Preservar enrollment/challenge TOTP e AAL2; retorno deve passar pelo resolver                                |
| Student            | `getStudentRequestContext` verifica sessão/MFA, mas não exige STUDENT; layout usa esse contexto                                                                   | Fechar boundary compartilhado, além dos checks já existentes nas applications                                |
| Teacher/Admin      | layouts e serviços usam guards de role; RPCs repetem role/AAL2                                                                                                    | Destino pós-login não substitui guard nem RLS                                                                |
| Agenda P16         | `get_agenda_sessions()` agrega ocupação, próprio booking e boolean de entitlement; `book_live_session(uuid)` bloqueia sessão e retorna mesmo UUID no retry BOOKED | Manter RPC e contrato de sucesso; enriquecer projeção e erro sem criar motor paralelo                        |
| Booking            | `private.validate_booking()` bloqueia sessão, exige SCHEDULED, entitlement positivo em `new.booked_at` e capacidade                                               | Falta quota por cadence; booking após starts_at não é explicitamente bloqueado no trigger                    |
| Comercial          | `private.entitlement_limit(user,key,at)` resolve subscription TRIALING/ACTIVE, período e versão temporal de plan_entitlements; boolean atual usa now              | Não alterar helper global para aplicar quota a Materials/Practice; criar resolução quantitativa de Live      |
| Rebooking          | RPC rejeita booking anterior não BOOKED; domínio converte qualquer próprio booking não ativo em CLOSED                                                            | Evoluir ambos; atualizar testes que documentam ausência de rebooking                                         |
| Attendance P17     | `attendance` guarda ATTENDED/NO_SHOW; `session_bookings` só aceita BOOKED/CANCELLED/TEACHER_CANCELLED                                                             | Não adicionar ATTENDED/NO_SHOW aos status de booking; attendance não gera consumo adicional                  |
| Teacher scope      | `private.is_teacher_assigned` verifica assignment temporal e TEACHER+AAL2; `can_view_student` agrega owner/helper/Admin                                           | Evoluir relação aditivamente e revisar todos os consumidores da policy                                       |
| Teacher Operations | RPCs listam/alteram somente sessões cujo teacher_id pertence ao ator ativo; roster mínimo via SECURITY DEFINER                                                    | Cohort dá relação pedagógica, não propriedade de todas as sessões nem direito de attendance de outro teacher |
| Live RLS           | `live_sessions_authenticated_select` permite SCHEDULED/COMPLETED genericamente, além de teacher/staff/booking próprio                                             | Cohort exige alterar policy, não apenas filtro da UI/RPC                                                     |
| Home P21           | adapter compõe Learning/Practice/Schedule; Schedule lê booking próprio BOOKED, sessão SCHEDULED, ends_at futuro, ordenação e limit(1)                             | Preservar facts/port e seleção determinística; avaliar efeito do novo filtro RLS no join                     |
| Progresso P20      | projeção curricular e resultados mantêm origens distintas                                                                                                         | Sem score novo ou refactor; scope de Teacher deve respeitar novos vínculos e revogações                      |
| Harness/CI         | scripts oficiais, suites SQL explícitas e teste real de concorrência por duas conexões                                                                            | Novos SQL tests precisam entrar no runner; existir no disco não os executa                                   |

Fluxos que serão evoluídos:

```text
login/callback → contexto Auth → MFA quando necessário → /auth/continue → workspace
Agenda → get_agenda_sessions → book_live_session → validação DB → booking + audit
Subscription → Plan → PlanEntitlement temporal → Entitlement → quota Live
Teacher → teachers ativo → sessões próprias / assignment OU cohort autorizada
Home → port Schedule → booking próprio vigente (sem recalcular quota ou membership)
```

Migrations de referência: `20260929035100_create_domain_contracts.sql` (modelo, entitlement_limit, validate_booking), `20260929043000_auth_rbac_rls.sql` (helpers/policies/audit/grants), `20260929102000_canonical_vertical_slice.sql`, `20260929233000_observability_analytics_audit.sql`, migrations P13/P15, `20261001005500_agenda_v1_booking.sql`, `20261001030000_teacher_operations_v1.sql`, `20261001155659_admin_content_v1.sql`, `20261001190000_assessment_engine_v1.sql`. Nenhuma será editada.

## 2. Preparação e sequência

1. Reconsultar main remota antes de implementar; se mudou, atualizar checkout/base e revisar o delta. Criar a branch indicada sem incorporar trabalho alheio silenciosamente.
2. Instanciar GOAL principal de implementação com allowlist abaixo, três checkpoints e registry planned/in_progress, verified:false. Registrar plano, decisões e evidência por etapa.
3. Ler integralmente documentos obrigatórios do pedido e ADRs relevantes. Antes de escrever rotas, ler guias pertinentes em `node_modules/next/dist/docs/`, conforme AGENTS.md; usar versões instaladas, sem upgrade incidental.
4. Implementar P21.1 e testar focadamente; depois P21.2; depois P21.3; executar integration pass; só então gates finais.

## 3. P21.1 — role router e entrypoints

### Arquivos e boundaries

- Evoluir `src/modules/auth/security.ts` e exports de `src/modules/auth/index.ts`: classificação de destinos internos, workspace autorizado e decisão determinística pura.
- Novo resolver server-only em `src/server/auth/` e rota `/auth/continue` em `src/app/auth/continue/`.
- Atualizar `src/app/(auth)/login/actions.ts`, página de login se necessário, `src/app/auth/callback/route.ts`, `src/app/mfa/page.tsx` e `mfa-panel.tsx`.
- Fechar STUDENT em `src/server/student/request-context.ts`; preservar cache por request e client autenticado compartilhado. Conferir layouts, pages e Server Actions que o consomem.
- Novo `/workspace` protegido e `/admin` mínimo redirecionando para `/admin/content`, usando os route groups atuais e primitives aprovados.
- Revisar `src/server/auth/guards.ts`, `src/lib/supabase/proxy.ts` e `src/app/page.tsx` somente se necessário para continuidade; não transferir autorização exclusivamente ao proxy/layout.

### Decisão de navegação

Resolver sempre sessão verificada e roles duráveis. Staff AAL1 vai primeiro a MFA, inclusive SUPPORT e contas STUDENT+staff. Após AAL2, resolver roles novamente. STUDENT-only → /home; TEACHER-only → /teacher; ADMIN-only → /admin; SUPPORT-only → /profile. Conta sem role reconhecida vai à superfície neutra protegida, sem concessão implícita de STUDENT.

Multi-role com mais de um workspace entre STUDENT/TEACHER/ADMIN vai ao seletor quando não houver destino autorizado explícito. Um next válido pode representar a escolha explícita do workspace e preservar deep link. SUPPORT não cria quarto portal; /profile continua acessível às contas autenticadas dentro do contrato MFA existente.

Sanitizar antes de classificar: path interno normalizado; rejeitar URL externa, protocol-relative, barras invertidas, controles e formas codificadas perigosas. Classificar segmentos completos, não prefixos frágeis (/teacherXYZ ≠ /teacher). Query string não concede role; permissões de recurso continuam nos guards/RLS. Rejeitar next para workspace sem role e destinos de controle que causariam ciclos de login/MFA/continue.

Preservar recovery: `/auth/callback?next=/reset-password` deve continuar funcionando como fluxo autenticado específico, sem substituí-lo automaticamente por /home. Após MFA, carregar contexto atualizado no servidor; nextPath do Client Component será o boundary de continuação, não autoridade sobre o workspace.

**Migration:** nenhuma obrigatória para P21.1; roles e MFA já existem. Testes DB podem demonstrar guards existentes sem alterar schema.

### Testes focados

- Estender `tests/unit/security-contracts.test.ts`; novo teste do resolver para role única/múltipla, SUPPORT, sem role, AAL1/AAL2 e next adversarial.
- Integration de login/callback/continue, recovery, contexto Student e refresh direto; cobrir role removida após login e MFA sem loop.
- Estender E2E Teacher/Admin atuais e adicionar spec de workspace; MFA real pelos helpers existentes, sem mock de AAL2.
- Provar Teacher sem STUDENT bloqueado nas seis rotas Student e respectivas actions; Student bloqueado em /teacher e /admin.

## 4. P21.2 — quota e booking transacional

### Modelo recomendado

Manter booking como fato de consumo, com snapshots duráveis adicionais: entitlement key aplicada, referência da versão comercial quando disponível, cadence, limit aplicado, starts_at considerado, timezone e janela [start,end). Usar unidade inteira 1; snapshot do limite não é contador. Reutilizar `cancelled_at`, validando quem o define; acrescentar provenance de backfill para fatos legados cuja configuração exata não seja recuperável.

Não criar contador mutável nem tabela genérica de créditos. O histórico das transições e snapshots anteriores ao rebooking permanece em audit append-only; o booking guarda a aplicação vigente. Índice por user/key/data considerada e, quando útil, janela; identity UNIQUE(live_session_id,user_id) permanece.

Separar duas referências temporais: **janela de consumo usa starts_at da sessão**; **autorização/configuração comercial segue o momento do comando**, preservando resolução temporal existente e sem exigir que a subscription já cubra uma sessão futura. Registrar o instante do comando no snapshot. Eventual mudança para validar assinatura no dia da sessão depende de decisão futura explícita.

Centralizar America/Recife no boundary DB de quota e expor a mesma decisão no domínio, aproveitando `YAS_SCHEDULE_TIME_ZONE` existente. Cohort timezone serve ao contexto/agenda; não altera timezone comercial V1. WEEK proposta: segunda-feira 00:00 local até segunda seguinte; MONTH: primeiro dia 00:00 até primeiro dia seguinte; limites half-open convertidos para timestamptz. NONE mantém acesso positivo existente, sem limite recorrente, janela nula.

Configurações quantitativas de Live devem ter limite inteiro; não arredondar numeric(10,2) silenciosamente, nem restringir entitlements não quantitativos. Configuração fracionária para Live é erro de configuração, com teste e diagnóstico. Em troca futura de cadence, contar fatos de consumo por key e instante de sessão dentro da janela candidata, sem excluir fatos só porque têm snapshot de cadence antiga. Upgrade/downgrade não apaga consumo nem invalida reservas retroativamente.

### Consumo e transições

| Fato                                     | Consumo              | Tratamento                                             |
| ---------------------------------------- | -------------------- | ------------------------------------------------------ |
| BOOKED                                   | 1                    | Inclui booking com attendance ATTENDED/NO_SHOW         |
| Attendance ATTENDED/NO_SHOW              | Sem efeito adicional | Persistência separada continua intacta                 |
| CANCELLED antes de starts_at considerado | 0                    | Timestamp servidor, liberação derivada                 |
| CANCELLED no início ou depois            | 1                    | Não devolver crédito automaticamente                   |
| TEACHER_CANCELLED                        | 0                    | Transição explícita autorizada e auditada              |
| Rebooking de CANCELLED                   | 1 se permitido       | Mesma linha/UUID; snapshot vigente e audit do anterior |

Cancelamento/retry precisa ter estado final idempotente e não emitir duas liberações. Rebooking exige sessão futura SCHEDULED, visibilidade, entitlement, quota e capacidade. Não abrir rebooking de TEACHER_CANCELLED por inferência. Não permitir alteração de ownership ou sessão do booking.

Alterações de starts_at/entitlement/cohort de sessão com bookings não devem deslocar consumo ou autorização silenciosamente. V1 deve rejeitar essas mudanças incompatíveis no banco; remarcação e reconciliação ampla ficam fora de escopo. Cancelamento da sessão pelo Teacher autorizado deve marcar reservas como TEACHER_CANCELLED atomicamente; apenas mudar live_sessions.status deixaria consumo retido. Manter capacity liberada por status de booking, independentemente do consumo de cancelamento tardio.

### Protocolo transacional

1. Verificar auth.uid() e STUDENT no RPC; session id é o único dado de identidade do comando.
2. Bloquear live_sessions com FOR UPDATE, como hoje; sessão deve existir, estar SCHEDULED e não ter começado.
3. Adquirir lock transacional por Student, por exemplo advisory lock com chave determinística de namespace + user_id. Serializar todos os comandos de consumo/liberação desse Student, mesmo em sessões distintas. Esta opção é deliberadamente mais ampla que user+window e evita brechas por troca de key/cadence.
4. Ler/bloquear booking existente; retry BOOKED devolve mesmo UUID sem novo consumo/audit de criação, inclusive quando a quota já estiver cheia.
5. Resolver configuração, membership quando aplicável, janela e consumo após locks; SELECTs da validação mutável precisam observar commits liberados pelo lock. Não colocar contagem crítica em helper STABLE com snapshot anterior à espera.
6. Aplicar quota e capacidade; INSERT ou reativação da mesma linha; audit da transição na mesma transação. Falha reverte todos os efeitos de sucesso.

Ordem global: sessões em ordem de UUID → locks de usuários em ordem determinística → bookings. Student cancel/rebook e Teacher cancellation em lote devem seguir a mesma ordem. Revisar triggers e mark_teacher_attendance para evitar inversão; RPC atual de attendance bloqueia booking e apenas lê sessão, portanto não adicionar lock tardio de sessão sem ajustar ordem. Validar deadlock/timeout sob duas conexões reais.

O trigger `private.validate_booking()` continua proteção de persistência. RPC e trigger devem chamar helpers compartilhados, sem dois conjuntos de regras divergentes. DML authenticated segue negado. Escritas privilegiadas também precisam respeitar o protocolo; documentar boundary obrigatório e guards para updates incompatíveis. Lock global em config comercial não é necessário para cada booking: resolver uma versão consistente e persistir snapshot; futuras mutations de billing deverão cumprir o contrato de versionamento.

Advisory locks são uma proposta de implementação; eficácia depende de todos os caminhos participantes usarem a mesma chave/ordem. Referência: [PostgreSQL — explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html).

### Audit de sucesso e negativa

Preservar `session_bookings_audit`/taxonomia SECURITY_* e enriquecer transições com previous/new status e snapshots mínimos. Não adicionar trigger duplicado produzindo dois fatos de criação. Corrigir idempotência de audit em retries sem mutação. Analytics `live_session_booked:<booking_id>` continua estável e não mede créditos.

**Quota denied não pode ser INSERT seguido de RAISE na mesma transação**, pois o audit seria revertido. Proposta compatível: nova RPC de resultado tipado para comando de booking, que retorna sucesso ou QUOTA_EXCEEDED e persiste negativa sem exception; app usa esse boundary. Manter `book_live_session(uuid) -> uuid` como wrapper de compatibilidade delegando ao mesmo núcleo. O wrapper legado pode continuar levantando erro, mas não pode prometer audit durável de negativa revertida; documentar e testar essa limitação. O boundary de resultado deve cobrir todos os callers oficiais e não permitir que client escreva audit arbitrário. Alternativa de auditoria separada server-only só será usada se preservar identidade e tratar falha de persistência explicitamente; não usar analytics como substituto.

### Backfill e migrations

Criar novas migrations pela CLI (`supabase migration new`, após conferir --help). Nomes conceituais, sem timestamps inventados:

1. `live_booking_usage_snapshot`: colunas, constraints, índices, helper de janela/resolução, backfill/provenance e proteção de snapshot.
2. `live_booking_quota_commands`: validação transacional, book/cancel/rebook/teacher cancellation, resultado tipado, wrapper, audit e projeção de quota.

Antes do backfill, inventariar BOOKINGS, versões comerciais vigentes em booked_at, snapshots de sessão disponíveis, cancelled_at nulos e consumo acima da quota. Resolver versão histórica por booked_at quando recuperável; nunca chamar config atual de histórica. Sem versão recuperável, marcar legado explicitamente e preservar o booking, contando consumo recuperável pela key/data da sessão. Cancelled sem timestamp confiável exige política de migração aprovada; não presumir liberação. Audit existente pode ajudar, mas não garante reconstrução completa. A ambiguidade bloqueia finalização do backfill em dados reais até resolução registrada.

Reservas legadas acima do limite continuam válidas; negar novo consumo na janela já ocupada. Relatório de reconciliação antes/depois e upgrade test com dados anteriores são obrigatórios. Sem apagar booking ou attendance. Backfill fica transacional com schema/guards antes de reabrir comandos.

Se `get_agenda_sessions()` mudar RETURNS TABLE, CREATE OR REPLACE sozinho não aceita mudar o tipo de retorno: recriar função em migration transacional e restaurar grants, após verificar dependentes; ou usar RPC versionada com wrapper de shape anterior. Preferir uma implementação comum. Encapsular novos campos de quota total/used/remaining/cadence/reason e adaptar TS; UI exibe resumo simples e disabled/reason. Projeção não reserva quota e pode ficar stale; mutation sempre revalida.

### Arquivos afetados

- `src/modules/schedule/{domain,application}/`, exports; `src/server/schedule/` e wrapper `src/server/live/book-session.ts` apenas se necessário.
- `src/app/(protected)/(student)/agenda/{page.tsx,actions.ts}` e UI Schedule: QUOTA_EXCEEDED, cancel/rebook mínimo e mensagens acessíveis.
- `src/modules/domain/entitlements.ts`/contracts somente para tipos reutilizáveis; preservar callers boolean e entitlements não recorrentes.
- Audit actions/privacy/observability quando necessários para novos fatos, sem bypass de autorização.
- Novas migrations; testes Schedule/comercial/DB/concurrency; seed/fixtures isolados.

## 5. P21.3 — cohorts e compatibilidade

### Modelo e administração

Novas tabelas públicas com RLS: cohorts (course_id, name, slug/code estável, status CHECK PLANNED/ACTIVE/ARCHIVED, timezone válido, starts_at/ends_at, timestamps); cohort_memberships (cohort/student/enrollment compatível, status ACTIVE/LEFT/COMPLETED, timestamps de vigência); cohort_teachers (cohort/teacher, principal, vínculo temporal). FK restritivas para histórico; períodos válidos; índice parcial impede duas memberships ativas da mesma pessoa/cohort e dois principais ativos. Reingresso cria novo episódio, sem apagar o anterior. Não criar PostgreSQL ENUM.

Adicionar `live_sessions.cohort_id` nullable com índice/FK; não backfillar cohorts fictícias em sessões existentes. Course segue conteúdo; Enrollment segue acesso ao curso; membership não concede plano, entitlement ou matrícula.

Commands ADMIN+AAL2: criar/editar metadados permitidos, ativar/arquivar, adicionar/remover Student e teacher. Validar roles dos alvos, teacher ativo, enrollment ACTIVE no mesmo Course e integridade de períodos. Vincular sessão à cohort exige compatibilidade do professor designado com cohort. Course/timezone/período com sessões/bookings exigem proteção contra alteração incompatível. Sem command atual de auto-enrollment, exigir matrícula existente.

Backend/domain/ports/server adapters em `src/modules/cohorts/` e `src/server/cohorts/`. RPCs autenticadas estreitas, ator derivado; mínimo administrativo sob `/admin/cohorts` se necessário para E2E de operação humana. Não inserir gestão de turmas nas entidades de Admin Content.

### Autorização centralizada

- Helper de elegibilidade de sessão: cohort_id null preserva caminho legado; cohort não nula requer membership ACTIVE e cohort operacionalmente ativa para nova disponibilidade/reserva. Documentar PLANNED/ARCHIVED sem inventar booking futuro de turma não ativa.
- Helper de relação Teacher–Student: TEACHER+AAL2, teachers ativo e (assignment temporal existente OU vínculo ativo de teacher e Student na mesma cohort ativa). Reutilizar no ponto central `private.is_teacher_assigned` ou helper equivalente chamado por ele; manter assinatura de `private.can_view_student`.
- Revisar policies de profiles, enrollments, lesson_progress, practice attempts/results, assessment attempts/responses/scores e demais consumidores de `can_view_student`: evolução de cohort amplia relação pedagógica autorizada, não grants editoriais ou gabaritos.
- Evoluir `live_sessions_authenticated_select`: remover bypass genérico para sessões de cohort; proteger SELECT direto, aggregate RPC e mutation com mesma elegibilidade. Guards explícitos em SECURITY DEFINER, que não dependem de RLS para restringir suas próprias queries.
- Leitura de booking próprio/histórico deve continuar possível após saída da turma. Separar disponibilidade nova de fatos próprios: sessão ligada a booking próprio pode ter metadata mínima legível sem passar a ser reservável. Isso preserva Home e evita join `!inner` eliminar booking vigente silenciosamente.
- Student lê apenas própria membership e metadata mínima da própria turma. Sem SELECT que exponha roster de colega por relação com cohort.
- Teacher AAL2 lê cohorts atribuídas e membros ativos minimizados. Remoção/arquivamento encerra acesso derivado da turma; assignment independente válido continua permitindo acesso.
- Teacher Operations continua listando suas sessões e exigindo proprietário para attendance. Não trocar `private.is_teacher_for_session` por relação ampla de cohort. Co-professor não ganha automaticamente edição/attendance de sessões alheias.
- ADMIN+AAL2 administra; AAL1 e anon negados; SUPPORT não recebe novo roster pedagógico.

### Migrations propostas

3. `cohorts_v1_model`: tabelas, índices, checks/FKs, RLS ligado e sem janela de grant aberto; live_sessions.cohort_id nullable.
4. `cohorts_v1_authorization_commands`: helpers/policies/reads/commands/audit, elegibilidade em booking e Agenda; grants SELECT mínimos por coluna/DTO e EXECUTE explícitos. Nenhum DML authenticated para tabelas de administração.

Todas as novas funções sensíveis com `SET search_path = ''`, objetos qualificados e REVOKE PUBLIC/anon; conceder apenas execução necessária. RLS ligada antes de grants. Preferir helpers privados e RPCs públicas estreitas no padrão do projeto. [Supabase — RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

## 6. Contratos de regressão P13–P21

| Fase              | Contrato intocado                                                                               | Evidência/testes a manter                                                               |
| ----------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| P13 Learning      | enrollment/publicação; progress/posição monotônicos, ownership, analytics idempotente           | learning-progress unit, learning application, vertical_slice_persistence, canonical E2E |
| P14 Materials     | signed URLs privadas e TTL, lookup autorizado, favorites próprios                               | materials unit/application/E2E, RLS assets/storage                                      |
| P15 Practice      | tentativa/resposta/resultado únicos; PENDING_MANUAL sem score inventado                         | practice unit/application, practice_persistence, canonical E2E                          |
| P16 Agenda        | auth.uid(), UNIQUE booking, capacidade, nenhum DML browser                                      | schedule unit/application, schedule_booking, duas conexões reais                        |
| P17 Teacher       | TEACHER+AAL2, sessão própria, roster mínimo, attendance separada e audit                        | teacher_operations SQL, unit/application/E2E e MFA helper                               |
| P18 Admin Content | ADMIN+AAL2, publicação ancestral, DRAFT sem vazamento, nenhuma tabela de conteúdo paralela      | admin_content SQL/unit/application/E2E e ADR 0006                                       |
| P19 Assessment    | versões e score com provenance; scoring_config/answer_key/rubric protegidos                     | assessment_engine SQL e assessments unit/application                                    |
| P20 Progress      | currículo ≠ CEFR; sem novo score, sem fonte durável duplicada                                   | progress unit/application, canonical E2E/goldens aplicáveis                             |
| P21 Home          | read-only, uma primaryAction, prioridade determinística, partial/error; Schedule bound limit(1) | home-projection unit, home application, canonical E2E e goldens                         |

Preservar `/profile`, password reset e TOTP. Student context continua cacheado por request e adapters usam client autenticado, sem service role no caminho normal. Não alterar providers, vídeo, assessment policy de reaplicação, site público, penalidades ou P21.4+.

## 7. Testes focados e integration pass

P21.1: Vitest por arquivo Auth/security/context/actions; Playwright workspace + Teacher/Admin/recovery. P21.2: Schedule unit/application + SQL booking/quota + concorrência. P21.3: cohorts unit/application + SQL/RLS, Teacher Operations e booking filtrado. Durante desenvolvimento não executar verify:full/build/E2E inteiro repetidamente.

Comandos-base focados (nomes novos serão criados na implementação):

```text
npx vitest run tests/unit/security-contracts.test.ts tests/unit/auth-routing.test.ts tests/integration/auth-routing.test.ts
npx vitest run tests/unit/schedule.test.ts tests/integration/schedule-application.test.ts
psql -v ON_ERROR_STOP=1 -f supabase/tests/schedule_booking.sql
psql -v ON_ERROR_STOP=1 -f supabase/tests/booking_quota.sql
node scripts/test-schedule-concurrency.mjs
npx vitest run tests/unit/cohorts.test.ts tests/integration/cohorts-application.test.ts
psql -v ON_ERROR_STOP=1 -f supabase/tests/cohorts.sql
npx playwright test tests/e2e/workspace-entry.spec.ts tests/e2e/teacher-operations.spec.ts tests/e2e/cohorts-booking.spec.ts
```

Usar DATABASE_URL de banco local migrado/seed e CANONICAL_E2E conforme setup atual; não imprimir credenciais. Acrescentar SQL novos às listas integration/rls em `scripts/run-sql-tests.mjs`; evolução mínima de `verify-db.mjs`/`verify-security.mjs` para proteger novos invariantes. Workflow oficial permanece intacto; suas suites passam a cobrir arquivos registrados no runner.

Matriz obrigatória de quota: WEEK 1 allow/deny/semana seguinte; MONTH 1 allow/deny/mês seguinte; NONE; limite zero/fracionário inválido; sessão no limite civil Recife; booking hoje para próxima janela; entitlement keys independentes; snapshot preservado após mudança de config; cancelamento antes/no instante/depois; rebook mesmo UUID; NO_SHOW/ATTENDED sem crédito; Teacher cancellation; retry com quota cheia.

Concorrência real: (a) usuários distintos disputando capacity=1, (b) mesmo usuário em sessões distintas da mesma key/window com limit=1, (c) retry mesma sessão, (d) cancel/rebook competindo com reserva, (e) Teacher cancellation versus attendance/booking. Barreiras de sincronização em duas conexões para garantir sobreposição; não depender de timing casual. Assertar contagem final, UUIDs, consumo, audit e motivo da rejeição. Estender teste de capacidade existente, sem substituí-lo pelo teste de quota.

RLS: Student A/B, anon, SUPPORT, Teacher A/B, Admin AAL1/AAL2, Teacher AAL1/AAL2 e multi-role. Exercitar SELECT direto e RPC SECURITY DEFINER, DML direto negado, UUID estrangeiro, membership/cohort/assignment revogados, reingresso e sessão legada null. Confirmar que cohort não revela gabaritos, billing, e-mails ou roster para Student.

Integration pass:

1. Student login → Home → Agenda → sessão própria cohort → booking → excesso bloqueado → cancel antecipado → rebook → Home vê booking vigente.
2. Student sem membership não vê disponibilidade nem reserva por RPC direta; entitlement ausente também bloqueia com membership válida.
3. Teacher login → MFA real → Teacher; lista sessão própria, consulta cohort atribuída; assignment legado ainda funciona; attendance própria persiste, foreign session negada.
4. Admin login → MFA → /admin → operação mínima de cohort, audit e revogação verificáveis.
5. Multi-role → seletor → escolha permitida; next forjado não cruza role; refresh/logout/login/recovery preservados.
6. Home mantém seleção e estado parcial em erros dos adapters; cancelled/completed session nunca vira ação prioritária; join RLS preserva fatos próprios autorizados.

Fixtures: manter contas dev e seed existentes. Cohort Basic/Intermediate são dados; ao menos dois Students e dois Teachers, enrollment existente, sessões próprias/estrangeiras/null, semanas/meses distintos. Isolar massa comercial de quota das fixtures canônicas de Materials/Practice/Home; evitar que novo booking altere prioridade visual existente. Atualizar setup/assert-canonical apenas no necessário; clocks determinísticos nas assertions civis.

## 8. Gate final e evidências

Antes dos gates: diff dentro do GOAL, migrations históricas intactas, documentação/ADRs alinhados com o que foi implementado, todos os focused checks verdes. Revisar baseline visual e estados; não atualizar golden para esconder mudança.

Executar literalmente uma vez por candidato final estável: `npm run verify:agent`, `npm run verify:security`, `npm run verify:db`, `npm run verify:ui`, `npm run verify:full`. Há sobreposição real hoje: verify:agent inclui core/security; verify:full chama verify (core + DB integration/RLS), Harness/security/evals, E2E/a11y/Storybook/goldens; verify:ui repete suites de UI. Preservar logs dos aliases exigidos pelo pedido, sem adicionar execuções avulsas redundantes de build/unit/E2E. Preparar fixture canônica e Supabase local antes de verify:ui; verify:full gerencia reset/stack próprios. Não enfraquecer scripts para eliminar repetição.

`verify:db` é verificação estrutural, não prova por si só replay/RLS. Provar ambos os caminhos: duas bases limpas como Official CI e upgrade a partir do schema deste SHA com bookings legados. Verificar migrations/seed/relação de grants e reconciliação de consumo. Runner DB executa concorrência no suite integration.

Capturar comando, exit code, SHA, runtime/OS, resultado e caminho de log em `harness/evidence/p21-p0-foundation-closure/`; UI com desktop/tablet/mobile e revisão de screenshots/a11y; DB com replay/upgrade/RLS/concurrency; audit com fatos após commit. Falha → diagnóstico e focused correction; novo candidato requer gate final novamente, sem relaxar assertions/timeout/RLS/workflow.

Commit/push/PR contra main, sem merge; observar Official CI no SHA/merge-ref correto e confirmar Supply Chain, Quality, Database, Guardrail Simulations, Preview e CI Gate. Registrar URL/run/artifacts e distinguir implementação SHA de merge-ref. Apenas depois da evidência final inspecionada marcar iniciativa done/verified:true. Falhas repetíveis corrigidas devem ganhar proteção/teste e registro conforme harness/ratchet.md.

## 9. Documentação e decisões

Adicionar três ADRs (routing/workspace, booking usage/snapshot/locks, cohorts/scope). Atualizar ROADMAP, DATA_MODEL, AUTH_RBAC_RLS, LIVE_CLASSES, BILLING, ARCHITECTURE, OPERATIONS e OPEN_QUESTIONS apenas para decisões implementadas. ADR 0003 deve receber referência de evolução do scope para não manter assignment-only como verdade atual contraditória. Registrar temporalidade do entitlement, semana civil, regra de legado e proteção de edição de sessão.

OPEN_QUESTIONS mantém meeting/billing/video providers, reaplicação/assessment, recuperação staff e regras avançadas de cancelamento/remarcação/reposição. Reformular apenas a parte já resolvida por V1, sem declarar política comercial completa fechada.

## 10. Riscos e condições de revisão

| Risco                                                   | Proteção planejada                                                                          |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Lock de sessão não protege quota entre sessões          | Lock por Student + contagem após lock + teste duas sessões                                  |
| Inversão de locks/trigger com cancelamento e attendance | Ordem explícita; lotes ordenados; teste real de corrida/deadlock                            |
| Backfill inventar estado comercial histórico            | Relatório/provenance; versão temporal recuperável; ambiguidade registrada antes de concluir |
| Mudança de cadence ignorar consumo anterior             | Contagem por key/data na janela candidata; snapshots não reescritos                         |
| Audit denied desaparecer em rollback                    | Resultado tipado com commit de negativa; wrapper legado documentado                         |
| Acesso cross-cohort via Data API ou definer             | Policy e RPC guards; teste direto positivo/negativo                                         |
| Helper Teacher ampliar acesso editorial/score sensível  | Inventário de consumidores e testes P13–P19; grants por coluna preservados                  |
| Co-professor ganhar sessões/attendance alheias          | Separar scope pedagógico de propriedade operacional P17                                     |
| Membership removida esconder booking vigente da Home    | Histórico próprio legível, nova reserva negada; teste join/RLS e Home                       |
| MFA/next provocar loops ou quebrar recovery             | Resolver após MFA, path role-aware, testes callback/reset/refresh                           |
| Fixtures novas contaminar golden/consumo canônico       | IDs/usuários/comercial isolados, setup determinístico                                       |
| RPC RETURNS TABLE/grants quebrar durante migration      | Recriação transacional ou versionamento com núcleo comum; teste upgrade                     |
| Cancelar sessão não liberar quota dos bookings          | Transição TEACHER_CANCELLED atômica por command autorizado                                  |
| História alterada por editar sessão reservada           | Guard DB rejeita mudanças incompatíveis; remarcação fora desta V1                           |

Pontos para decisão/revisão durante implementação: segunda-feira como início semanal proposto; estratégia concreta de legado irrecuperável após inventário; comportamento operacional de sessão reservada quando vínculo de turma deixa de estar ativo, sem inventar cancelamento automático; extensão mínima da UI Admin para E2E. Esses pontos não autorizam antecipar P21.4 ou P22.

Estado desta entrega: plano produzido; implementação planned / verified:false. Nenhum gate de produto foi executado nesta análise, nenhuma garantia nova de PASS ou regressão zero foi feita.
