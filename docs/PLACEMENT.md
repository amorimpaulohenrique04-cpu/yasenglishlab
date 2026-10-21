# Enrollment Core / Placement V1

Placement orchestrates Commercial, Assessment and Cohorts; it does not copy their source records. Entry requires an existing ACTIVE subscription within its confirmed period (TRIALING is not payment confirmation). Local fixtures use the existing synthetic Commercial provider, never a new billing integration.

One initial case per Student references the confirmed subscription and a single Assessment attempt. No automatic second attempt or retake policy is introduced. Existing engine RPCs score objective evidence; Placement never writes `result_cefr` or cut scores.

The operational learning track is a published active **Course**, identified by UUID/title. This is a routing contract, not a validated pedagogical taxonomy or official CEFR level. Teacher selects it from durable courses, supplies feedback and qualitative confidence, and is recorded as provenance. A finalized review is immutable; identical retry returns it, conflicting retry fails. Teacher requires TEACHER+AAL2 and existing assignment/cohort scope; Admin cannot impersonate Teacher review.

`cohort_placement_settings` is the authoritative recurring weekly schedule for matching, in the cohort's existing IANA timezone, plus capacity (1–6). It is not inferred from LiveSessions. LiveSessions remain individual occurrences. V1 availability is a weekly weekday/minute window in the same IANA timezone; every scheduled cohort window must fit a Student preference. Cross-timezone conversion and overnight windows are not silently inferred. Admin configures settings before offering a cohort; no schedule means no candidate. Settings cannot change once memberships exist; capacity can only change without undercutting occupancy.

Self-service matches exactly the recommended Course, active/published Course and active current Cohort, all schedule windows and free capacity. Sort by cohort start then UUID. No AI, cross-track policy, inferred eligibility or plan-name checks. Backend repeats validation under cohort lock. Membership insert trigger shares the lock/capacity invariant with existing Admin commands, including writers outside Placement.

Recommendation (immutable review), initial Student choice (immutable decision) and current membership (case reference) remain separate. Admin+AAL2 may transfer an enrolled Student to a compatible active/published Course cohort with capacity, preserving review/choice/history, requiring a reason and stable operation UUID. Transfers acquire old/new cohort locks in UUID order; conflicting retries fail. Enrollment is created only at final choice, so track content is not granted during review.

Case states: PAYMENT_CONFIRMED → ASSESSMENT_REQUIRED → IN_PROGRESS → REVIEW_PENDING → PLACEMENT_READY → STUDENT_DECISION → ENROLLED. The engine's completion trigger enters review even for fully objective attempts; no CEFR inference. Viewing options explicitly enters STUDENT_DECISION through a command. Case transitions are narrow, audited and validated. Home only projects pending case state. Admin queue composes safe Assessment summary, review, choice and membership; billing fields are absent.

No notification delivery, billing provider, CEFR standard setting, retake policy or unrelated operation is added. OPEN_QUESTIONS remains binding.

## Etapa 11 — confirmação com período pago (ADR 0017)

`confirm_placement_choice` usa o mesmo predicado de acesso pago (`private.has_paid_access`). Um aluno `CANCELLED` com `current_period_end` futuro pode confirmar a turma até o fim do período pago. Matrículas `ACTIVE` sem turma ativa aparecem para o Admin em `/admin/enrollments` (`admin_enrollments_without_active_cohort`), substituindo a consulta SQL manual da etapa 6a.

## Etapa 12 E — matricula administrativa no proximo curso (ADR 0023)

`admin_enroll_in_course(p_user_id uuid, p_course_id uuid, p_cohort_id uuid,
p_operation_id uuid, p_reason text, p_context jsonb = {}) -> jsonb`

O RPC exige ADMIN+AAL2 e um alvo com role STUDENT. O curso de destino deve estar ativo/publicado;
a turma deve pertencer a ele, estar ACTIVE, nao ter terminado e ter capacidade configurada em
`cohort_placement_settings`. A vaga e verificada sob o mesmo lock da turma usado por
`placement_capacity_guard`. Sem configuracao, a operacao falha em vez de inferir uma capacidade.
O Admin escolhe a turma explicitamente; este comando nao executa matching de horario nem altera
review, decision, placement_case ou referencias historicas do placement inicial.

O comando nao encerra outras matriculas ou memberships: COMPLETED e ACTIVE podem coexistir,
e uma matricula ACTIVE em outro curso tambem e preservada. Um destino ja COMPLETED e rejeitado;
este RPC de proximo curso nao reabre cursos concluidos. Um destino CANCELLED pode ser reativado
por `private.activate_enrollment`, mantendo o mesmo enrollment_id e sua auditoria existente.
Uma membership LEFT e preservada e uma nova e criada; uma membership ACTIVE efetiva na mesma turma
e reaproveitada, inclusive quando a turma esta cheia. Uma membership ACTIVE fora de seu periodo
exige reconciliacao explicita; o comando nao altera silenciosamente sua identidade ou datas.

Para evitar reabrir um destino concluido numa disputa de criacao, o RPC reserva a chave unica
aluno/curso com INSERT ON CONFLICT DO NOTHING e verifica a linha sob FOR UPDATE antes de chamar
`activate_enrollment`. Isso nao bloqueia a linha de Auth do aluno contra seus checkpoints de progresso.
O helper de conclusao da trilha pode concluir imediatamente uma matricula reativada cujas aulas ja foram feitas.

`operation_id` e obrigatorio. A tabela `admin_course_enrollment_operations` guarda um recibo imutavel,
com RLS e sem leitura/DML direto por anon/authenticated. Um advisory lock por operation_id serializa
chamadas concorrentes, inclusive com parametros diferentes. O mesmo id retorna exatamente o recibo
original se ator, aluno, curso, turma e motivo normalizado por btrim forem iguais; qualquer diferenca falha.
O contexto tecnico pode variar no retry. A autorizacao Admin+AAL2 sempre e refeita; a elegibilidade
mutavel de curso/turma nao e reexecutada ao devolver um recibo de operacao ja concluida.

Resposta: operationId, userId, courseId, cohortId, enrollmentId, membershipId,
enrollmentStatus e reusedMembership. A resposta e um retrato da execucao, nao uma consulta do estado atual.
Uma nova operacao para uma membership ja existente registra um novo recibo/audit sem duplicar a membership.

O motivo deve ter entre 1 e 1000 caracteres apos btrim. A auditoria `admin_course_enrolled` registra
o ator autenticado, IDs do resultado e motivo; p_context fornece request_id, environment e version,
sem definir o ator. Matricula, membership, recibo e auditoria sao atomicos: qualquer erro, inclusive tardio,
desfaz tambem a reativacao e seus audits. Nenhuma assinatura, cortesia ou entitlement e criado;
a matricula administrativa nao dispensa os guards de pagamento/entitlements na leitura de assets.

Banco: `20261015140000_stage_12e_admin_enroll_next_course.sql`.
Teste transacional: `supabase/tests/admin_course_enrollment.sql`, registrado em integration/rls
e alias admin-course-enrollment. Formulario Admin e aviso ao aluno permanecem nas sessoes de app da Etapa 12.

## Etapa 12B — avaliação de entrada explícita

O Admin com AAL2 cria e publica avaliações em /admin/assessments (ADR 0021). Somente a avaliação marcada is_placement é escolhida para novas tentativas de entrada. O índice parcial mantém seleção única; publicar como entrada troca a seleção atomicamente. Não há escolha implícita por data de criação.

Cada tentativa guarda assessment_version_id. Publicações futuras preservam o conteúdo e as respostas das tentativas existentes. O Admin cria nova versão para alterar conteúdo publicado e não pode aposentar a única versão publicada da avaliação de entrada. Questões humanas seguem revisão pedagógica e não atribuem automaticamente CEFR.

## Auditoria 2026-10-18 — becos sem saída

Disponibilidade: `save_placement_preferences` aceita edição até STUDENT_DECISION. Sem turma compatível,
`/onboarding/placement` mostra o formulário de disponibilidade e a lista é recalculada ao salvar.

Matrícula administrativa: `admin_enroll_in_course` continua sem alterar o caso. Uma membership ACTIVE
efetiva numa turma ACTIVE com matrícula ACTIVE (`private.has_active_cohort_enrollment`) encerra a jornada
de entrada na leitura: Home, rotas pedagógicas e onboarding deixam de exigir a escolha de turma, e os alertas
STALE_DECISION e PLACEMENT_NO_COHORT deixam de contar o aluno. O caso permanece no estado em que estava.

Troca de revisor: `reassign_placement_teacher(p_case_id, p_teacher_id, p_reason)` exige ADMIN+AAL2 e caso
REVIEW_PENDING. Encerra (sem apagar) as atribuições diretas sem curso de outros professores, cria a nova
atribuição e audita `placement_teacher_reassigned` com motivo e professores anteriores. Retry idêntico não
gera nova auditoria. `assign_placement_teacher` continua recusando empilhar revisores.

Prática sem revisor: o alerta `PRACTICE_NO_REVIEWER` lista alunos com resposta SUBMITTED/PENDING_MANUAL sem
professor ativo atribuído nem professor ativo de turma ativa.

Banco: `20261018150000_placement_practice_dead_ends.sql`. Teste: `supabase/tests/placement_practice_dead_ends.sql`.


## Formal pedagogical levels (2026-10-21)

Courses remain the shared curriculum. Cohorts optionally declare pedagogical_level BASIC, INTERMEDIATE or ADVANCED; NULL preserves the legacy contract. New reviews in a course with formal-level cohorts require recommended_level, separate from recommended_course_id and CEFR. Historical reviews remain immutable and NULL-level reviews offer only legacy cohorts. finalize_placement_review extends its single signature with optional p_level; old callers remain valid for legacy courses. Student candidate listing and final confirmation match both course and level under the existing authorization.

Admin promotion reuses transfer_placement_cohort with reason, operation ID, AAL2 and audit. It can select another level while retaining the original recommendation/choice. The deferred membership constraint is checked immediately before the transfer returns; ordinary writes check immediately. Concurrent writers serialize by enrollment. Existing legacy overlapping paths are preserved; a formal level cannot overlap another membership of the same enrollment. Classification becomes immutable after membership history; configure levels before adding students. No production records are classified automatically.
