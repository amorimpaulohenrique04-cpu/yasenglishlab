import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import {
  Alert,
  Avatar,
  Badge,
  Button,
  EmptyState,
  Input,
  PageHeader,
  ProgressBar,
  Tabs,
} from "@/components/ui";
import { placementLabels, type PlacementState } from "@/modules/placement";
import {
  loadComplimentaryGrant,
  type ComplimentaryGrantView,
} from "@/server/billing/complimentary-access";
import { loadAdminStudent360 } from "@/server/students/students";
import { grantComplimentaryAccessAction, revokeComplimentaryAccessAction } from "./actions";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Recife",
  dateStyle: "medium",
  timeStyle: "short",
});

function date(value: string | null) {
  return value ? dateFormatter.format(new Date(value)) : "—";
}

function placementLabel(value: string) {
  return (Object.keys(placementLabels) as PlacementState[]).includes(value as PlacementState)
    ? placementLabels[value as PlacementState]
    : value;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="yas-operational-section" aria-label={title}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

const accessResults: Record<string, { tone: "success" | "error"; title: string }> = {
  granted: { tone: "success", title: "Acesso concedido" },
  revoked: { tone: "success", title: "Acesso revogado" },
  invalid: { tone: "error", title: "Revise o motivo e a validade" },
  error: { tone: "error", title: "Não foi possível alterar o acesso" },
};

// ADR 0017: access without a subscription only through an explicit, audited grant (ADMIN + AAL2 RPC).
function ComplimentaryAccess({
  userId,
  grant,
  result,
}: {
  userId: string;
  grant: ComplimentaryGrantView | null;
  result: string | undefined;
}) {
  const feedback = result ? accessResults[result] : undefined;
  return (
    <Section title="Acesso concedido">
      {feedback && <Alert tone={feedback.tone} title={feedback.title} />}
      <p>
        Libera aulas, materiais, prática e encontros sem assinatura (cortesia, bolsa ou legado). Não
        concede benefícios de plano: conteúdos e encontros que exigem um benefício específico
        continuam indisponíveis.
      </p>
      {grant ? (
        <div className="yas-row-summary">
          <h3>
            <Badge tone={grant.active ? "success" : "neutral"}>
              {grant.active ? "Ativo" : grant.revokedAt ? "Revogado" : "Expirado"}
            </Badge>
          </h3>
          <p>
            {grant.reason === "LEGACY_BACKFILL"
              ? "Aluno legado (migração)"
              : "Concedido pelo Admin"}{" "}
            · desde {date(grant.grantedAt)}
            {grant.expiresAt ? ` · até ${date(grant.expiresAt)}` : ""}
            {grant.revokedAt ? ` · revogado em ${date(grant.revokedAt)}` : ""}
          </p>
        </div>
      ) : (
        <p>Nenhuma concessão registrada.</p>
      )}
      {grant?.active ? (
        <form action={revokeComplimentaryAccessAction} className="yas-stack">
          <input type="hidden" name="userId" value={userId} />
          <Input label="Motivo da revogação" name="note" required maxLength={500} />
          <div>
            <Button type="submit" variant="secondary">
              Revogar acesso
            </Button>
          </div>
        </form>
      ) : (
        <form action={grantComplimentaryAccessAction} className="yas-stack">
          <input type="hidden" name="userId" value={userId} />
          <Input label="Motivo da concessão" name="note" required maxLength={500} />
          <Input
            label="Válido até (opcional)"
            name="expiresOn"
            type="date"
            message="Sem data, o acesso vale até ser revogado."
          />
          <div>
            <Button type="submit" variant="primary">
              Conceder acesso
            </Button>
          </div>
        </form>
      )}
    </Section>
  );
}

export default async function AdminStudent360Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  if (!uuidPattern.test(id)) notFound();
  const student = await loadAdminStudent360(id);
  if (!student.profile) notFound();
  const query = await searchParams;
  const accessResult = typeof query.access === "string" ? query.access : undefined;
  const grant = await loadComplimentaryGrant(id);

  const name = student.profile.display_name;
  const activeCohort = student.activeMembership?.cohort?.[0];
  const activeCourse =
    activeCohort?.course?.[0]?.title ?? student.curriculum[0]?.course_title ?? null;
  const activeEnrollment = student.enrollments.find((enrollment) => enrollment.status === "ACTIVE");
  const validAssessments = student.assessments.filter(
    (attempt) => attempt.status === "SCORED" && attempt.scored_at,
  );
  const markedAttendance = student.attendance.filter((booking) => booking.attendance?.[0]?.status);
  const attendedCount = markedAttendance.filter(
    (booking) => booking.attendance?.[0]?.status === "ATTENDED",
  ).length;

  const timeline = [
    ...validAssessments.map((attempt) => ({
      id: `assessment-${attempt.id}`,
      label: "Assessment pontuado",
      detail: attempt.assessment?.[0]?.assessment?.[0]?.title ?? "Resultado válido",
      at: attempt.scored_at as string,
    })),
    ...(student.placementReview?.finalized_at
      ? [
          {
            id: "review",
            label: "Revisão finalizada",
            detail: student.placementReview.course?.[0]?.title ?? "Recomendação registrada",
            at: student.placementReview.finalized_at,
          },
        ]
      : []),
    ...(student.placementDecision
      ? [
          {
            id: "decision",
            label: "Escolha do aluno",
            detail: `${student.placementDecision.cohort?.[0]?.name ?? "Turma"} · ${student.placementDecision.course?.[0]?.title ?? "Curso"}`,
            at: student.placementDecision.created_at,
          },
        ]
      : []),
    ...student.placementTransfers.map((transfer) => ({
      id: transfer.operation_id,
      label: "Transferência registrada",
      detail: `${transfer.target?.[0]?.name ?? "Turma"} · ${transfer.reason}`,
      at: transfer.created_at,
    })),
  ].sort((left, right) => right.at.localeCompare(left.at));

  return (
    <div className="yas-operational-surface">
      <Link href="/admin/students">Voltar para alunos</Link>
      <PageHeader
        title={name}
        description={`Perfil de aluno · cadastro em ${date(student.profile.created_at)}`}
      />
      <section className="yas-row-summary" aria-label="Identidade e estado atual do aluno">
        <div className="yas-cluster">
          <Avatar fallback={name.slice(0, 2).toUpperCase()} label={name} size="lg" />
          <div>
            <p>{activeCohort?.name ?? "Sem turma atual"}</p>
            <p>{activeCourse ?? "Sem curso atual"}</p>
            <p>
              Professor principal:{" "}
              {student.primaryTeacher?.teacher?.[0]?.profile?.[0]?.display_name ?? "Não atribuído"}
            </p>
          </div>
        </div>
        <div className="yas-cluster" aria-label="Estados operacionais">
          <Badge tone={activeEnrollment ? "success" : "neutral"}>
            {activeEnrollment ? "Matrícula ativa" : "Sem matrícula ativa"}
          </Badge>
          {student.placement && (
            <Badge tone="info">{placementLabel(student.placement.state)}</Badge>
          )}
        </div>
      </section>

      <Tabs
        ariaLabel={`Seções do perfil de ${name}`}
        defaultValue="overview"
        items={[
          {
            id: "overview",
            label: "Visão geral",
            content: (
              <div className="yas-operational-surface">
                <Section title="Resumo operacional">
                  <div className="yas-metric-strip">
                    <div className="yas-metric-card">
                      <span className="yas-metric-label">Frequência registrada</span>
                      <strong className="yas-metric-value">{attendedCount}</strong>
                      <span className="yas-metric-detail">
                        presenças em {markedAttendance.length} registros marcados
                      </span>
                    </div>
                    <div className="yas-metric-card">
                      <span className="yas-metric-label">Progresso curricular</span>
                      <strong className="yas-metric-value">
                        {student.curriculum[0]
                          ? `${student.curriculum[0].completion_percent}%`
                          : "—"}
                      </strong>
                      <span className="yas-metric-detail">
                        {student.curriculum[0]?.course_title ?? "Sem curso publicado"}
                      </span>
                    </div>
                    <div className="yas-metric-card">
                      <span className="yas-metric-label">Próxima sessão</span>
                      <strong className="yas-metric-value">
                        {student.upcomingSession ? date(student.upcomingSession.starts_at) : "—"}
                      </strong>
                      <span className="yas-metric-detail">
                        {student.upcomingSession?.title ?? "Nenhuma sessão marcada"}
                      </span>
                    </div>
                    <div className="yas-metric-card">
                      <span className="yas-metric-label">Placement</span>
                      <strong className="yas-metric-value">
                        {student.placement ? placementLabel(student.placement.state) : "—"}
                      </strong>
                      <span className="yas-metric-detail">
                        {student.placement
                          ? `Atualizado em ${date(student.placement.state_changed_at)}`
                          : "Sem caso de entrada"}
                      </span>
                    </div>
                  </div>
                </Section>
                <Section title="Direcionamento atual">
                  <div className="yas-row-summary">
                    <h3>{activeCohort?.name ?? "Sem turma atual"}</h3>
                    <p>{activeCourse ?? "Sem curso / trilha atual"}</p>
                    <p>
                      Professor principal:{" "}
                      {student.primaryTeacher?.teacher?.[0]?.profile?.[0]?.display_name ??
                        "Não atribuído"}
                    </p>
                  </div>
                </Section>
              </div>
            ),
          },
          {
            id: "progress",
            label: "Progresso",
            content: (
              <div className="yas-operational-surface">
                <Section title="Currículo">
                  {student.curriculum.length ? (
                    student.curriculum.map((course) => (
                      <div className="yas-row-summary" key={course.enrollment_id}>
                        <h3>{course.course_title}</h3>
                        <p>
                          {course.lessons_completed} de {course.lessons_total} aulas concluídas
                        </p>
                        <ProgressBar
                          value={course.completion_percent}
                          label="Progresso curricular"
                        />
                        <p>Atividade recente: {date(course.latest_activity_at)}</p>
                      </div>
                    ))
                  ) : (
                    <EmptyState
                      title="Sem currículo publicado"
                      description="O progresso aparecerá quando houver um curso ativo com conteúdo publicado."
                    />
                  )}
                </Section>
                <Section title="Practice">
                  {student.practice.length ? (
                    student.practice.map((attempt) => (
                      <div className="yas-row-summary" key={attempt.id}>
                        <h3>{attempt.activity?.[0]?.title ?? "Atividade"}</h3>
                        <p>
                          {attempt.activity?.[0]?.skill ?? "—"} · {attempt.status} · iniciada em{" "}
                          {date(attempt.started_at)}
                        </p>
                        {attempt.result?.[0] && (
                          <p>
                            Resultado objetivo: {attempt.result[0].score ?? "—"}/
                            {attempt.result[0].max_score ?? "—"}
                          </p>
                        )}
                      </div>
                    ))
                  ) : (
                    <p>Nenhuma prática registrada.</p>
                  )}
                </Section>
                <Section title="Attendance">
                  {student.attendance.length ? (
                    student.attendance.map((booking) => (
                      <div className="yas-row-summary" key={booking.id}>
                        <h3>{booking.session?.[0]?.title ?? "Sessão"}</h3>
                        <p>
                          {booking.status} ·{" "}
                          {booking.attendance?.[0]?.status ?? "Presença pendente"} ·{" "}
                          {date(booking.session?.[0]?.starts_at ?? booking.booked_at)}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p>Nenhuma sessão registrada.</p>
                  )}
                </Section>
                <Section title="Assessment">
                  {validAssessments.length ? (
                    validAssessments.map((attempt) => (
                      <div className="yas-row-summary" key={attempt.id}>
                        <h3>
                          {attempt.assessment?.[0]?.assessment?.[0]?.title ?? "Avaliação"} ·{" "}
                          {date(attempt.scored_at)}
                        </h3>
                        {attempt.result_cefr && (
                          <p>Nível oficialmente registrado: {attempt.result_cefr}</p>
                        )}
                        <ul>
                          {attempt.skills.map((skill) => (
                            <li key={skill.skill}>
                              {skill.skill}: {skill.score}/{skill.max_score ?? "—"}
                              {skill.cefr_level ? ` · nível registrado ${skill.cefr_level}` : ""}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))
                  ) : (
                    <p>Nenhum resultado válido disponível.</p>
                  )}
                </Section>
              </div>
            ),
          },
          {
            id: "placement",
            label: "Placement",
            content: (
              <div className="yas-operational-surface">
                <Section title="Recomendação e escolha">
                  {student.placement ? (
                    <div className="yas-row-summary">
                      <Badge tone="info">{placementLabel(student.placement.state)}</Badge>
                      <p>Caso iniciado em {date(student.placement.created_at)}</p>
                      <p>
                        Recomendação original:{" "}
                        {student.placementReview?.course?.[0]?.title ?? "Aguardando revisão"}
                      </p>
                      <p>
                        Escolha registrada:{" "}
                        {student.placementDecision?.cohort?.[0]?.name ?? "Aguardando decisão"}
                      </p>
                      {student.placementReview && (
                        <p>
                          Confiança qualitativa: {student.placementReview.confidence} · revisada em{" "}
                          {date(student.placementReview.finalized_at)}
                        </p>
                      )}
                      {activeCohort &&
                        student.placementDecision?.cohort?.[0]?.name !== activeCohort.name && (
                          <Badge tone="warning">
                            Turma atual diferente da escolha inicial; histórico preservado
                          </Badge>
                        )}
                      {student.placementReview?.feedback && (
                        <p>{student.placementReview.feedback}</p>
                      )}
                    </div>
                  ) : (
                    <p>Nenhum caso de Placement registrado.</p>
                  )}
                </Section>
                <Section title="Histórico de Placement">
                  {timeline.length ? (
                    <ol className="yas-timeline">
                      {timeline.map((item) => (
                        <li key={item.id}>
                          <div className="yas-timeline-marker" aria-hidden="true" />
                          <div>
                            <h3>{item.label}</h3>
                            <p>{item.detail}</p>
                            <time dateTime={item.at}>{date(item.at)}</time>
                          </div>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p>Sem eventos históricos disponíveis.</p>
                  )}
                  {student.placementTransfers.length > 0 && (
                    <p>
                      {student.placementTransfers.length} transferência(s) registrada(s); os
                      vínculos continuam preservados.
                    </p>
                  )}
                </Section>
              </div>
            ),
          },
          {
            id: "sessions",
            label: "Sessões",
            content: (
              <div className="yas-operational-surface">
                <Section title="Próxima sessão">
                  {student.upcomingSession ? (
                    <div className="yas-row-summary">
                      <h3>{student.upcomingSession.title}</h3>
                      <time dateTime={student.upcomingSession.starts_at}>
                        {date(student.upcomingSession.starts_at)}
                      </time>
                    </div>
                  ) : (
                    <p>Nenhuma sessão futura reservada.</p>
                  )}
                </Section>
                <Section title="Sessões registradas">
                  {student.attendance.length ? (
                    student.attendance.map((booking) => (
                      <div className="yas-row-summary" key={booking.id}>
                        <h3>{booking.session?.[0]?.title ?? "Sessão"}</h3>
                        <p>
                          {booking.status} ·{" "}
                          {booking.attendance?.[0]?.status ?? "Presença pendente"} ·{" "}
                          {date(booking.session?.[0]?.starts_at ?? booking.booked_at)}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p>Nenhuma sessão registrada.</p>
                  )}
                </Section>
              </div>
            ),
          },
          {
            id: "commercial",
            label: "Comercial",
            content: (
              <div className="yas-operational-surface">
                <Section title="Assinatura local">
                  {student.subscriptions.length ? (
                    student.subscriptions.map((subscription, index) => (
                      <div
                        className="yas-row-summary"
                        key={subscription.status + subscription.started_at + index}
                      >
                        <h3>{subscription.status}</h3>
                        <p>
                          Período:{" "}
                          {date(subscription.current_period_start ?? subscription.started_at)} ·{" "}
                          {date(subscription.current_period_end ?? subscription.ended_at)}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p>Nenhum registro local de assinatura.</p>
                  )}
                </Section>
                <ComplimentaryAccess userId={id} grant={grant} result={accessResult} />
              </div>
            ),
          },
          {
            id: "history",
            label: "Histórico",
            content: (
              <div className="yas-operational-surface">
                <Section title="Matrículas">
                  {student.enrollments.length ? (
                    student.enrollments.map((enrollment) => (
                      <div className="yas-row-summary" key={enrollment.id}>
                        <h3>{enrollment.course?.[0]?.title ?? "Curso"}</h3>
                        <Badge
                          tone={
                            enrollment.status === "ACTIVE"
                              ? "success"
                              : enrollment.status === "COMPLETED"
                                ? "info"
                                : "neutral"
                          }
                        >
                          {enrollment.status}
                        </Badge>
                        <p>
                          Início: {date(enrollment.enrolled_at)} · Conclusão:{" "}
                          {date(enrollment.completed_at)}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p>Nenhuma matrícula registrada.</p>
                  )}
                </Section>
                <Section title="Vínculos de turma">
                  {student.memberships.length ? (
                    student.memberships.map((membership) => (
                      <div className="yas-row-summary" key={membership.id}>
                        <h3>{membership.cohort?.[0]?.name ?? "Turma"}</h3>
                        <p>
                          {membership.cohort?.[0]?.code ?? "—"} · {membership.status} ·{" "}
                          {membership.cohort?.[0]?.status ?? "—"}
                        </p>
                        <p>
                          Vínculo desde {date(membership.starts_at)} · Encerrado em{" "}
                          {date(membership.ends_at)}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p>Nenhum vínculo de turma registrado.</p>
                  )}
                </Section>
                <Section title="Atividade recente">
                  {student.recentProgress.length ? (
                    student.recentProgress.map((activity) => (
                      <div className="yas-row-summary" key={activity.id}>
                        <h3>{activity.lesson?.[0]?.title ?? "Aula"}</h3>
                        <p>
                          {activity.status} · último acesso {date(activity.last_accessed_at)}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p>Nenhuma atividade de aula registrada.</p>
                  )}
                </Section>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
