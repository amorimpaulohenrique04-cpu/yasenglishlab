"use client";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { m } from "motion/react";
import {
  Alert,
  Badge,
  Breadcrumbs,
  Button,
  Card,
  Drawer,
  EmptyState,
  Icon,
  PageHeader,
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
  reviewHref,
  studentDate,
  studentProfileUrl,
  type ProfileFilters,
  type StudentCommandResult,
  type StudentProfileData,
} from "../domain/student-workspace";
import {
  EnrollmentContext,
  EnrollmentStatus,
  StudentAttention,
  StudentEventList,
  StudentIdentity,
  StudentPagination,
  StudentProgress,
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
  const pendingReviews = <PendingReviews data={data} />;
  const courses = <CourseProgress data={data} />;
  const content =
    filters.tab === "summary" ? (
      <div className={styles.profileGrid}>
        <div className={styles.stack}>
          {courses}
          <Card className={styles.panel}>
            <h2>Últimas atividades</h2>
            <StudentEventList events={data.events.slice(0, 5)} />
            <Link className={styles.textLink} href={href({ tab: "activities" })}>
              Ver histórico de atividades <Icon name="arrow" size={15} />
            </Link>
          </Card>
        </div>
        <aside className={styles.stack}>
          {pendingReviews}
          <Card className={styles.panel}>
            <h2>Próxima sessão</h2>
            {data.nextSession ? (
              <div className={styles.nextSession}>
                <span className={styles.eventIcon} data-kind="session" aria-hidden="true">
                  <Icon name="video" size={20} />
                </span>
                <div>
                  <strong>{data.nextSession.title}</strong>
                  <time dateTime={data.nextSession.starts_at}>
                    {studentDate(data.nextSession.starts_at)}
                  </time>
                  <Link
                    className={styles.textLink}
                    href={`/teacher/sessoes/${data.nextSession.id}`}
                  >
                    Ver sessão <Icon name="arrow" size={14} />
                  </Link>
                </div>
              </div>
            ) : (
              <p className={styles.muted}>Nenhuma sessão futura reservada com você.</p>
            )}
          </Card>
          <Card className={styles.panel}>
            <h2>Acompanhamento</h2>
            <StudentAttention student={student} />
            <p className={styles.muted}>
              O alerta de sete dias considera os registros de aprendizagem acessíveis e só se aplica
              a matrículas ativas. A contagem respeita o início do vínculo.
            </p>
            <p className={styles.muted}>Datas e horários em America/Recife · GMT−3.</p>
          </Card>
        </aside>
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
                      <Badge tone="neutral">
                        {STATUS_LABELS[session.booking_status] ?? "Reserva registrada"}
                      </Badge>
                      <Badge tone={session.attendance_status === "NO_SHOW" ? "warning" : "neutral"}>
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
                    <Badge tone={item.status === "OPEN" ? "warning" : "neutral"}>
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
      <Link className={styles.back} href={filters.back}>
        <Icon name="left" size={15} />
        Voltar para alunos
      </Link>
      <PageHeader
        title="Perfil pedagógico"
        description="Progresso, evidências e acompanhamento individual."
      />
      <Card className={styles.profileHero}>
        <div className={styles.profileIdentity}>
          <StudentIdentity name={student.name} large />
          <div>
            <h2>{student.name}</h2>
            <div className={styles.badges}>
              {currentEnrollments.length ? (
                currentEnrollments.slice(0, 3).map((item) => (
                  <Badge key={item.id} tone="neutral">
                    {item.title}
                  </Badge>
                ))
              ) : (
                <Badge tone="neutral">Sem matrícula</Badge>
              )}
              {currentEnrollments.length > 3 && (
                <Badge tone="neutral">+{currentEnrollments.length - 3} cursos</Badge>
              )}
            </div>
            <p>
              {[...new Set(student.enrollments.flatMap((e) => e.cohorts.map((c) => c.name)))].join(
                " · ",
              ) || "Sem turma ativa"}
            </p>
          </div>
        </div>
        <div className={styles.heroMeta}>
          <StudentAttention student={student} />
          <span className={styles.muted}>
            Última atividade: {studentDate(student.last_activity?.occurred_at ?? null)}
          </span>
        </div>
        <div className={styles.heroActions}>
          <Button leadingIcon={<Icon name="pen" size={16} />} onClick={() => open("note")}>
            Adicionar nota
          </Button>
          <Button
            variant="outline"
            disabled={student.reassessment_open}
            leadingIcon={<Icon name="redo" size={16} />}
            onClick={() => open("reassessment")}
          >
            {student.reassessment_open ? "Novo teste solicitado" : "Pedir novo teste"}
          </Button>
        </div>
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
function CourseProgress({ data }: { data: StudentProfileData }) {
  return (
    <Card className={styles.panel}>
      <h2>Matrículas e progresso curricular</h2>
      <p className={styles.muted}>
        Média do progresso das aulas publicadas que compõem a trilha de cada matrícula, incluindo
        aulas ainda não iniciadas.
      </p>
      {data.student.enrollments.length ? (
        <ul className={styles.courseList}>
          {data.student.enrollments.map((enrollment) => (
            <li key={enrollment.id}>
              <div className={styles.sectionHeading}>
                <h3>{enrollment.title}</h3>
                <EnrollmentStatus enrollment={enrollment} />
              </div>
              <EnrollmentContext enrollment={enrollment} />
              <StudentProgress enrollment={enrollment} />
              {enrollment.progress !== null && (
                <p className={styles.muted}>
                  {enrollment.completed} de {enrollment.total} aulas concluídas
                </p>
              )}
              {enrollment.completed_at && (
                <small className={styles.muted}>
                  Conclusão registrada em {studentDate(enrollment.completed_at)}
                </small>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="Sem matrícula registrada"
          description="As trilhas aparecerão quando houver uma matrícula autorizada."
        />
      )}
      <p className={styles.disclaimer}>
        <Icon name="bulb" size={16} />
        Progresso curricular não equivale a proficiência CEFR.
      </p>
    </Card>
  );
}
function PendingReviews({ data }: { data: StudentProfileData }) {
  return (
    <Card className={styles.panel}>
      <h2>Pendências de acompanhamento</h2>
      {data.pending.length ? (
        <ul className={styles.pendingList}>
          {data.pending.map((item) => (
            <li key={`${item.kind}:${item.id}`}>
              <span className={styles.eventIcon} aria-hidden="true">
                <Icon name="file" size={17} />
              </span>
              <div>
                <strong>{item.title}</strong>
                <span>{item.kind === "entry" ? "Revisão de entrada" : "Revisão de prática"}</span>
                <Link className={styles.textLink} href={reviewHref(item.kind, item.id)}>
                  Abrir revisão <Icon name="arrow" size={14} />
                </Link>
              </div>
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
