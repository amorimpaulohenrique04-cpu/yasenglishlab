"use client";
import Link from "next/link";
import { useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { m } from "motion/react";
import {
  Alert,
  Badge,
  Breadcrumbs,
  Button,
  Card,
  Drawer,
  Dropdown,
  EmptyState,
  Icon,
  Popover,
  ProgressRing,
  Select,
  Tabs,
  Textarea,
  useToast,
} from "@/components/ui";
import {
  EVENT_KINDS,
  KIND_LABELS,
  PROFILE_TABS,
  STATUS_LABELS,
  lessonSteps,
  oldestPendingReview,
  recifeDateParts,
  reviewHref,
  studentPaceComparison,
  studentDate,
  studentProfileUrl,
  studentRelativeDate,
  studentReviewCta,
  studentSuggestedAction,
  studentTrend,
  studentWaitingLabel,
  type ProfileFilters,
  type StudentCommandResult,
  type StudentProfileData,
} from "../domain/student-workspace";
import {
  EnrollmentStatus,
  StudentEngagement,
  StudentEventList,
  StudentIdentity,
  StudentPagination,
} from "./student-shared";
import styles from "./students.module.css";

const tabs = {
  summary: "Resumo",
  activities: "Atividades",
  assessments: "Avaliações",
  notes: "Notas internas",
};
const skills: Record<string, string> = {
  READING: "Leitura",
  LISTENING: "Compreensão oral",
  SPEAKING: "Fala",
  WRITING: "Escrita",
  VOCABULARY: "Vocabulário",
  GRAMMAR: "Gramática",
  PRONUNCIATION: "Pronúncia",
};
export function StudentProfile({
  data,
  filters,
  commandAction,
}: {
  data: StudentProfileData;
  filters: ProfileFilters;
  commandAction: (input: unknown) => Promise<StudentCommandResult>;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startNavigation] = useTransition();
  const [composer, setComposer] = useState<"note" | "reassessment" | null>(null);
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [failure, setFailure] = useState("");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const student = data.student;
  const currentEnrollments = student.enrollments.filter((item) => item.status !== "CANCELLED");
  const href = (patch: Partial<ProfileFilters>) => studentProfileUrl(student.id, filters, patch);
  const navigate = (patch: Partial<ProfileFilters>) =>
    startNavigation(() => router.replace(href(patch), { scroll: false }));
  const open = (kind: "note" | "reassessment") => {
    setFailure("");
    setComposer(kind);
  };
  const save = async () => {
    if (!composer || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setFailure("");
    try {
      const result = await commandAction({
        kind: composer,
        studentId: student.id,
        body: composer === "note" ? note : reason,
      });
      if (!result.ok) {
        setFailure(result.message);
        return;
      }
      if (composer === "note") setNote("");
      else setReason("");
      toast({
        tone: "success",
        title: composer === "note" ? "Nota interna salva" : "Pedido de novo teste registrado",
        description:
          composer === "note"
            ? "A nota está disponível apenas para você."
            : "A equipe avaliará o pedido. O curso e a turma permanecem os mesmos.",
      });
      setComposer(null);
      router.refresh();
    } catch {
      setFailure("Não foi possível salvar agora. Seu texto foi preservado.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  const [now] = useState(() => Date.now());
  const primaryReview = oldestPendingReview(data.pending);
  const suggestion = studentSuggestedAction(student, data.pending);
  const pendingReviews = <PendingReviews data={data} now={now} />;
  const courses = <CourseProgress data={data} />;
  const cohorts = [...new Set(currentEnrollments.flatMap((e) => e.cohorts.map((c) => c.name)))];
  const metaLine = [
    currentEnrollments.length
      ? currentEnrollments
          .slice(0, 2)
          .map((item) => item.title)
          .join(" · ") +
        (currentEnrollments.length > 2 ? ` · +${currentEnrollments.length - 2} cursos` : "")
      : "Sem matrícula",
    cohorts.join(" · ") || "Sem turma ativa",
  ].join(" · ");
  const enrollmentChip = student.enrollments.some((e) => e.status === "ACTIVE")
    ? { tone: "success" as const, label: "Matrícula ativa" }
    : student.enrollments.some((e) => e.status === "COMPLETED")
      ? { tone: "muted" as const, label: "Curso concluído" }
      : { tone: "muted" as const, label: "Sem matrícula ativa" };
  const content =
    filters.tab === "summary" ? (
      <div className={styles.summaryGrid}>
        <div className={styles.stack}>
          {courses}
          <Card className={styles.panel}>
            <h2>Atividades recentes</h2>
            <StudentEventList events={data.events} grouped limit={5} />
            <Link className={styles.textLink} href={href({ tab: "activities" })}>
              Ver histórico de atividades <Icon name="arrow" size={15} />
            </Link>
          </Card>
        </div>
        <aside className={styles.stack}>{pendingReviews}</aside>
      </div>
    ) : filters.tab === "activities" ? (
      <div className={styles.profileGrid}>
        <Card className={styles.panel}>
          <div className={styles.sectionHeading}>
            <h2>Histórico de atividades</h2>
            <Select
              label="Tipo"
              value={filters.kind}
              onChange={(event) => navigate({ kind: event.target.value as ProfileFilters["kind"] })}
              options={EVENT_KINDS.map((value) => ({ value, label: KIND_LABELS[value] }))}
            />
          </div>
          {filters.kind === "session" ? (
            <p className={styles.muted}>
              Sessões aparecem na lista de sessões, presença e tarefas.
            </p>
          ) : (
            <>
              <StudentEventList events={data.events} />
              <StudentPagination
                page={filters.page}
                total={data.eventsTotal}
                pageSize={10}
                href={(page) => href({ page })}
                label="registros de atividade"
              />
            </>
          )}
        </Card>
        {(filters.kind === "all" || filters.kind === "session") && (
          <Card className={styles.panel}>
            <h2>Sessões, presença e tarefas</h2>
            <p className={styles.muted}>
              Somente sessões próprias acessíveis, com suas reservas e presenças registradas.
            </p>
            {data.sessions.length ? (
              <ul className={styles.sessionList}>
                {data.sessions.map((session) => (
                  <li key={session.id}>
                    <Link className={styles.textLink} href={`/teacher/sessoes/${session.id}`}>
                      {session.title}
                      <Icon name="arrow" size={14} />
                    </Link>
                    <time dateTime={session.starts_at}>{studentDate(session.starts_at)}</time>
                    <div className={styles.badges}>
                      <Badge tone="muted">
                        {STATUS_LABELS[session.booking_status] ?? "Reserva registrada"}
                      </Badge>
                      <Badge tone={session.attendance_status === "NO_SHOW" ? "warning" : "muted"}>
                        {session.attendance_status
                          ? (STATUS_LABELS[session.attendance_status] ?? "Presença registrada")
                          : (STATUS_LABELS[session.status] ?? "Sessão registrada")}
                      </Badge>
                    </div>
                    {session.homework.map((task) => (
                      <div key={task.id} className={styles.homework}>
                        <strong>{task.title}</strong>
                        <p>{task.instructions}</p>
                        {task.due_at && <small>Prazo: {studentDate(task.due_at)}</small>}
                      </div>
                    ))}
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.emptySmall}>Sem sessões nesta página.</p>
            )}
            <StudentPagination
              page={filters.sessionsPage ?? 1}
              total={data.sessionsTotal}
              pageSize={10}
              href={(sessionsPage) => href({ sessionsPage })}
              label="sessões"
            />
          </Card>
        )}
      </div>
    ) : filters.tab === "assessments" ? (
      <div className={styles.profileGrid}>
        <Card className={styles.panel}>
          <h2>Avaliações e pedidos de novo teste</h2>
          <p className={styles.muted}>
            Resultados registrados preservam o histórico. O progresso do curso não é uma medida de
            proficiência.
          </p>
          {data.evaluations.length ? (
            <ul className={styles.evaluationList}>
              {data.evaluations.map((item) => (
                <li key={`${item.kind}:${item.id}`}>
                  <div className={styles.sectionHeading}>
                    <strong>{item.title}</strong>
                    <Badge tone={item.status === "OPEN" ? "warning" : "muted"}>
                      {STATUS_LABELS[item.status] ?? "Registrada"}
                    </Badge>
                  </div>
                  <time dateTime={item.occurred_at ?? undefined}>
                    {studentDate(item.occurred_at)}
                  </time>
                  {item.reason && <p className={styles.preserveText}>{item.reason}</p>}
                  {item.resolution && (
                    <p className={styles.preserveText}>
                      <strong>Resposta da equipe:</strong> {item.resolution}
                    </p>
                  )}
                  {item.result_cefr && <p>Resultado registrado na avaliação: {item.result_cefr}</p>}
                  {!!item.scores.length && (
                    <dl className={styles.skillScores}>
                      {item.scores.map((score, index) => (
                        <div key={`${score.skill}:${index}`}>
                          <dt>{skills[score.skill] ?? "Habilidade avaliada"}</dt>
                          <dd>
                            {score.score != null && score.max_score != null
                              ? `${score.score} / ${score.max_score}`
                              : "Sem pontuação"}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.emptySmall}>Nenhuma avaliação enviada ou pedido registrado.</p>
          )}
          <StudentPagination
            page={filters.page}
            total={data.evaluationsTotal}
            pageSize={10}
            href={(page) => href({ page })}
            label="avaliações e pedidos"
          />
        </Card>
        <aside className={styles.stack}>
          {pendingReviews}
          <Card className={styles.panel}>
            <h2>Teste de entrada</h2>
            {data.placement ? (
              <>
                <Badge tone="info">
                  {STATUS_LABELS[data.placement.state] ?? "Processo registrado"}
                </Badge>
                {data.placement.recommended_course && (
                  <p>
                    Curso recomendado: <strong>{data.placement.recommended_course}</strong>
                  </p>
                )}
                {data.placement.chosen_cohort && (
                  <p>
                    Turma escolhida: <strong>{data.placement.chosen_cohort}</strong>
                  </p>
                )}
                {data.placement.feedback && (
                  <blockquote className={styles.quote}>{data.placement.feedback}</blockquote>
                )}
                {data.placement.finalized_at && (
                  <small className={styles.muted}>
                    Revisão finalizada em {studentDate(data.placement.finalized_at)}
                  </small>
                )}
              </>
            ) : (
              <p className={styles.emptySmall}>Sem processo de Entrada registrado.</p>
            )}
          </Card>
        </aside>
      </div>
    ) : (
      <Card className={styles.panel}>
        <div className={styles.sectionHeading}>
          <div>
            <h2>Suas notas internas</h2>
            <p className={styles.muted}>
              Estas notas não são enviadas ao aluno e ficam visíveis apenas para você.
            </p>
          </div>
          <Button leadingIcon={<Icon name="plus" size={16} />} onClick={() => open("note")}>
            Adicionar nota
          </Button>
        </div>
        {data.notes.length ? (
          <ul className={styles.notes}>
            {data.notes.map((note) => (
              <li key={note.id}>
                <span className={styles.noteIcon} aria-hidden="true">
                  <Icon name="pen" size={17} />
                </span>
                <div>
                  <time dateTime={note.created_at}>{studentDate(note.created_at)}</time>
                  <p className={styles.preserveText}>{note.body}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="Nenhuma nota interna"
            description="Registre observações que ajudem no seu acompanhamento pedagógico."
          />
        )}
        <StudentPagination
          page={filters.page}
          total={data.notesTotal}
          pageSize={10}
          href={(page) => href({ page })}
          label="notas"
        />
      </Card>
    );
  return (
    <div className={styles.page}>
      <Breadcrumbs
        homeHref="/teacher"
        homeLabel="Início do professor"
        items={[{ label: "Alunos", href: filters.back }, { label: student.name }]}
      />
      <Card className={styles.profileHero}>
        <div className={styles.heroTop}>
          <StudentIdentity name={student.name} size="lg" />
          <div className={styles.profileIdentity}>
            <h1>{student.name}</h1>
            <p className={styles.heroMetaLine}>{metaLine}</p>
            <div className={styles.badges}>
              <Badge tone={enrollmentChip.tone}>{enrollmentChip.label}</Badge>
              {data.placement && data.placement.state !== "ENROLLED" && (
                <Badge tone="info">
                  Entrada: {STATUS_LABELS[data.placement.state] ?? "processo registrado"}
                </Badge>
              )}
              {student.reassessment_open && <Badge tone="warning">Novo teste solicitado</Badge>}
            </div>
          </div>
          <div className={styles.heroActions}>
            {primaryReview ? (
              // Segmented CTA: the button and its waiting time share one bordered group.
              <div
                className={styles.ctaGroup}
                data-split={primaryReview.submitted_at ? "" : undefined}
              >
                <Link
                  className={`yas-button yas-button--primary ${styles.reviewCta}`}
                  href={reviewHref(primaryReview.kind, primaryReview.id)}
                  aria-describedby={primaryReview.submitted_at ? "hero-cta-context" : undefined}
                >
                  <Icon name={primaryReview.kind === "entry" ? "file" : "pen"} size={17} />
                  {studentReviewCta(primaryReview.kind)}
                  <Icon name="arrow" size={16} className={styles.reviewCtaArrow} />
                </Link>
                {primaryReview.submitted_at && (
                  <span id="hero-cta-context" className={styles.ctaMeta}>
                    <Icon name="clock" size={14} />
                    {primaryReview.kind === "entry" ? "Enviado" : "Enviada"}{" "}
                    {studentWaitingLabel(primaryReview.submitted_at, now)}
                  </span>
                )}
              </div>
            ) : suggestion.href ? (
              // Inactivity itself is already shown in the follow-up strip.
              <Link className="yas-button yas-button--outline" href={suggestion.href}>
                {student.inactive ? "Agendar sessão" : suggestion.text}
              </Link>
            ) : null}
            <Dropdown
              label="Mais ações"
              icon="more"
              items={[
                {
                  id: "note",
                  label: "Adicionar nota",
                  icon: "pen",
                  onSelect: () => open("note"),
                },
                {
                  id: "reassessment",
                  label: student.reassessment_open ? "Novo teste solicitado" : "Pedir novo teste",
                  icon: "redo",
                  disabled: student.reassessment_open,
                  onSelect: () => open("reassessment"),
                },
              ]}
            />
          </div>
        </div>
        <FollowUpStrip data={data} now={now} />
      </Card>
      <section className={styles.profileTabs} aria-busy={pending}>
        <Tabs
          variant="underline"
          ariaLabel="Seções do perfil pedagógico"
          value={filters.tab}
          onValueChange={(tab) => navigate({ tab: tab as ProfileFilters["tab"] })}
          items={PROFILE_TABS.map((tab) => ({
            id: tab,
            label: tabs[tab],
            ...(tab === "notes" ? { badge: data.notesTotal } : {}),
            content: (
              <m.div
                key={tab}
                initial={{ opacity: 0.85 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.16 }}
              >
                {content}
              </m.div>
            ),
          }))}
        />
      </section>
      <Drawer
        open={composer !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen && !savingRef.current) setComposer(null);
        }}
        title={composer === "reassessment" ? "Pedir novo teste" : "Adicionar nota interna"}
        icon={composer === "reassessment" ? "redo" : "pen"}
        description={
          composer === "reassessment"
            ? "O pedido será analisado pela equipe. Não inicia um teste nem altera curso ou turma."
            : "Visível apenas para você. Esta nota não será enviada ao aluno."
        }
        footer={
          <>
            <Button variant="ghost" disabled={saving} onClick={() => setComposer(null)}>
              Cancelar
            </Button>
            <Button form="student-composer" type="submit" loading={saving}>
              {composer === "reassessment" ? "Registrar pedido" : "Salvar nota"}
            </Button>
          </>
        }
      >
        <form
          id="student-composer"
          onSubmit={(event) => {
            event.preventDefault();
            startNavigation(save);
          }}
          className={styles.composer}
        >
          {failure && <Alert tone="error" title="Não foi possível salvar" description={failure} />}
          <Textarea
            label={composer === "reassessment" ? "Justificativa" : "Nota interna"}
            name="body"
            required
            minLength={composer === "reassessment" ? 10 : 1}
            maxLength={composer === "reassessment" ? 1000 : 4000}
            rows={8}
            value={composer === "reassessment" ? reason : note}
            disabled={saving}
            onChange={(event) =>
              composer === "reassessment"
                ? setReason(event.target.value)
                : setNote(event.target.value)
            }
          />
          <small className={styles.counter}>
            {(composer === "reassessment" ? reason : note).length}/
            {composer === "reassessment" ? 1000 : 4000}
          </small>
        </form>
      </Drawer>
    </div>
  );
}
const RING_GRADIENT = "student-ring-gradient";
function CourseProgress({ data }: { data: StudentProfileData }) {
  return (
    <Card className={styles.panel}>
      <h2>Progresso curricular</h2>
      {/* Shared gradient for the rings' value stroke (referenced from CSS). */}
      <svg width="0" height="0" className={styles.svgDefs} aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id={RING_GRADIENT} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--yas-color-purple-500)" />
            <stop offset="100%" stopColor="var(--yas-color-purple-700)" />
          </linearGradient>
        </defs>
      </svg>
      {data.student.enrollments.length ? (
        <ul className={styles.courseList}>
          {data.student.enrollments.map((enrollment) => {
            const steps = lessonSteps(enrollment.completed, enrollment.total);
            return (
              <li key={enrollment.id} className={styles.courseRow}>
                {enrollment.progress !== null ? (
                  <span className={styles.courseRing}>
                    <ProgressRing
                      value={enrollment.progress}
                      size={72}
                      stroke={7}
                      label={`Progresso em ${enrollment.title}`}
                    >
                      <strong>{enrollment.progress}%</strong>
                    </ProgressRing>
                  </span>
                ) : (
                  <span className={styles.courseRingEmpty} aria-hidden="true">
                    —
                  </span>
                )}
                <div className={styles.courseInfo}>
                  <div className={styles.sectionHeading}>
                    <h3>{enrollment.title}</h3>
                    <EnrollmentStatus enrollment={enrollment} />
                  </div>
                  {steps.segments > 0 && (
                    <div
                      className={styles.lessonSteps}
                      role="img"
                      aria-label={`${enrollment.completed} de ${enrollment.total} ${enrollment.total === 1 ? "aula concluída" : "aulas concluídas"}`}
                    >
                      {Array.from({ length: steps.segments }, (_, i) => (
                        <span key={i} data-done={i < steps.filled || undefined} />
                      ))}
                    </div>
                  )}
                  <p className={styles.muted}>
                    {enrollment.progress !== null
                      ? `${enrollment.progress}% do conteúdo · ${enrollment.completed} de ${enrollment.total} ${enrollment.total === 1 ? "aula concluída" : "aulas concluídas"} · inclui aulas em andamento`
                      : "Sem progresso disponível"}
                  </p>
                  {enrollment.completed_at && (
                    <small className={styles.muted}>
                      Conclusão registrada em {studentDate(enrollment.completed_at)}
                    </small>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          title="Sem matrícula registrada"
          description="As trilhas aparecerão quando houver uma matrícula autorizada."
        />
      )}
      <Badge tone="muted" icon="bulb" className={styles.cefrNote}>
        Progresso curricular não equivale a proficiência CEFR
      </Badge>
    </Card>
  );
}
function FollowUpStrip({ data, now }: { data: StudentProfileData; now: number }) {
  const { student, engagement, nextSession } = data;
  // Prefer a meaningful interaction; fall back to any learning activity so the strip
  // never says "sem interações" while Ritmo counts activity.
  const event = engagement.lastRelevantEvent ?? student.last_activity;
  const trend = studentTrend(engagement.learningLast7, engagement.learningPrev7);
  const pace = studentPaceComparison(engagement.learningLast7, engagement.learningPrev7);
  const session = nextSession ? recifeDateParts(nextSession.starts_at) : null;
  return (
    <section className={styles.followStrip} aria-labelledby="follow-up-title">
      <div className={styles.stripHead}>
        <h2 id="follow-up-title">Acompanhamento</h2>
        <HowWeCalculate />
      </div>
      <dl>
        <div>
          <dt>
            <span className={styles.metricIcon} data-tint="green" aria-hidden="true">
              <Icon name="flame" size={16} />
            </span>
            Engajamento
          </dt>
          <dd>
            <StudentEngagement student={student} pulse />
          </dd>
        </div>
        <div>
          <dt>
            <span className={styles.metricIcon} data-tint="lilac" aria-hidden="true">
              <Icon name="bars" size={16} />
            </span>
            Ritmo
          </dt>
          <dd>
            <span className={styles.paceRow}>
              <span className={styles.metricValue}>{engagement.learningLast7} em 7 dias</span>
              <span className={styles.trendPill} data-tone={pace.tone}>
                <span aria-hidden="true">{pace.deltaLabel}</span>
                <span className={styles.srOnly}>{trend.text}</span>
              </span>
            </span>
            <span
              className={styles.paceChart}
              role="img"
              aria-label={`Últimos 7 dias: ${engagement.learningLast7}; 7 dias anteriores: ${engagement.learningPrev7}`}
            >
              {(
                [
                  ["7 dias", engagement.learningLast7, pace.lastPct, "last"],
                  ["Anterior", engagement.learningPrev7, pace.prevPct, "prev"],
                ] as const
              ).map(([label, value, pct, week]) => (
                <span key={week} className={styles.paceLine} aria-hidden="true">
                  <span>{label}</span>
                  <span className={styles.paceTrack}>
                    <span style={{ inlineSize: `${pct}%` }} data-week={week} />
                  </span>
                  <span>{value}</span>
                </span>
              ))}
            </span>
          </dd>
        </div>
        <div>
          <dt>
            <span className={styles.metricIcon} data-tint="blue" aria-hidden="true">
              <Icon name="history" size={16} />
            </span>
            Última interação
          </dt>
          <dd>
            {event ? (
              <>
                <span className={styles.metricValue}>{event.title}</span>
                <time className={styles.timeChip} dateTime={event.occurred_at}>
                  {studentRelativeDate(event.occurred_at, now)}
                </time>
              </>
            ) : (
              <span className={styles.metricValue}>Sem interações registradas</span>
            )}
          </dd>
        </div>
        <div>
          <dt>
            <span className={styles.metricIcon} data-tint="yellow" aria-hidden="true">
              <Icon name="cal" size={16} />
            </span>
            Próxima sessão
          </dt>
          <dd>
            {nextSession && session ? (
              <span className={styles.sessionChip}>
                <time className={styles.dateBlock} dateTime={nextSession.starts_at}>
                  <strong>{session.day}</strong>
                  <span>{session.month}</span>
                </time>
                <span className={styles.sessionText}>
                  <Link className={styles.textLink} href={`/teacher/sessoes/${nextSession.id}`}>
                    {nextSession.title}
                  </Link>
                  <small>{session.time}</small>
                </span>
              </span>
            ) : (
              <span className={styles.metricValue}>Nenhuma</span>
            )}
          </dd>
        </div>
      </dl>
    </section>
  );
}
function HowWeCalculate() {
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={styles.infoButton}
        popoverTarget={id}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Como calculamos"
        title="Como calculamos"
      >
        <Icon name="info" size={16} />
      </button>
      <Popover
        id={id}
        anchorRef={triggerRef}
        open={open}
        onOpenChange={setOpen}
        placement="bottom-end"
        role="dialog"
        aria-label="Como calculamos"
      >
        <div className={styles.infoSurface}>
          <strong>Como calculamos</strong>
          <p>
            O alerta de sete dias considera os registros de aprendizagem acessíveis e só se aplica a
            matrículas ativas. A contagem respeita o início do vínculo.
          </p>
          <p>Datas e horários em America/Recife · GMT−3.</p>
        </div>
      </Popover>
    </>
  );
}
function PendingReviews({ data, now }: { data: StudentProfileData; now: number }) {
  return (
    <Card className={styles.panel}>
      <h2>Pendências</h2>
      {data.pending.length ? (
        <ul className={styles.pendingList}>
          {data.pending.map((item) => (
            <li key={`${item.kind}:${item.id}`}>
              <span className={styles.eventIcon} aria-hidden="true">
                <Icon name={item.kind === "entry" ? "file" : "pen"} size={17} />
              </span>
              <div>
                <strong>{item.title}</strong>
                <span>
                  {item.kind === "entry" ? "Teste de entrada" : "Prática"}
                  {item.submitted_at ? ` · ${studentWaitingLabel(item.submitted_at, now)}` : ""}
                </span>
              </div>
              <Link
                className="yas-button yas-button--outline yas-button--sm"
                href={reviewHref(item.kind, item.id)}
                aria-label={`Abrir revisão: ${item.title}`}
              >
                Abrir revisão
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.emptySmall}>Nenhuma revisão pendente para este aluno.</p>
      )}
      {data.student.reassessment_open && (
        <Badge tone="warning">Pedido de novo teste em aberto</Badge>
      )}
    </Card>
  );
}
