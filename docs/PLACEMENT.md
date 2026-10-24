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

## Entrada do professor — redesign 2026-10-23

A fila `/teacher/revisoes/placement` possui busca, filtros/paginação na URL, indicadores no escopo autenticado e SLA interno existente de 24 horas. `teacher_entry_queue` retorna somente resumos; evidências são carregadas ao abrir o caso.

`placement_review_drafts` guarda uma cópia pessoal por caso/professor (curso opcional, confiança, feedback, notas, revisão e datas de salvamento). Leituras exigem autor + TEACHER/AAL2 + atribuição vigente. Gravações diretas são revogadas. `save_teacher_entry_draft` serializa pelo caso e verifica a versão esperada. Abrir a página não cria rascunho.

`finalize_teacher_entry` salva a cópia pessoal e chama a finalização canônica na mesma transação. Recomendações continuam únicas, imutáveis e com retry idempotente; rascunhos ficam somente leitura depois da conclusão. Os eventos de analytics existentes são preservados. Notas nunca entram nas projeções do aluno.

`get_placement_review_evidence` inclui ids, posição, tipo e gabarito da versão para o professor autorizado. Gabaritos de respostas manuais podem ser nulos. Não há nova coleta de confiança do aluno, inferência CEFR ou envio de notificações.

`PlacementReviewAssistant` define o contrato sem provedor ativo. A UI informa indisponibilidade e mantém escrita manual. Não há SDK, chave ou chamada de IA nesta entrega. Avaliação posterior: Groq GPT-OSS 20B e Gemini Flash-Lite; escolha por custo e qualidade pedagógica, com preços revalidados na ativação.
