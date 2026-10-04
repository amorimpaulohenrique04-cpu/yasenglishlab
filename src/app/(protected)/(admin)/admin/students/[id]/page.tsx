import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar, Badge, Card, PageHeader } from "@/components/ui";
import { loadAdminStudent360 } from "@/server/students/students";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function date(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(value));
}

export default async function AdminStudent360Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuidPattern.test(id)) notFound();
  const student = await loadAdminStudent360(id);
  if (!student.profile) notFound();

  return (
    <div className="yas-stack">
      <Link href="/admin/students">Voltar para alunos</Link>
      <PageHeader
        title={student.profile.display_name}
        description={
          "Cadastro em " +
          date(student.profile.created_at) +
          " · " +
          student.profile.locale +
          " · " +
          student.profile.timezone
        }
      />
      <div className="yas-inline">
        <Avatar
          fallback={student.profile.display_name.slice(0, 2).toUpperCase()}
          label={student.profile.display_name}
          size="lg"
        />
        <div>
          <p>
            {student.profile.locale} · {student.profile.timezone}
          </p>
          <p>Perfil de aluno · cadastro em {date(student.profile.created_at)}</p>
        </div>
      </div>
      <Card className="yas-stack">
        <h2>Visão operacional</h2>
        <p>
          {student.curriculum.reduce((sum, course) => sum + Number(course.lessons_completed), 0)}{" "}
          aulas concluídas · {student.enrollments.length} matrículas
          {" · "}
          {student.memberships.length} vínculos de turma
        </p>
        <p>
          Etapa de entrada: {student.placement?.state ?? "Sem caso de entrada"}
          {student.placement ? " · atualizado em " + date(student.placement.state_changed_at) : ""}
        </p>
        {student.upcomingSession && (
          <p>
            Próxima sessão: {student.upcomingSession.title} ·{" "}
            {date(student.upcomingSession.starts_at)}
          </p>
        )}
      </Card>
      <section className="yas-stack" aria-labelledby="student-current-heading">
        <h2 id="student-current-heading">Vínculo atual</h2>
        {student.activeMembership ? (
          <Card>
            <h3>{student.activeMembership.cohort?.[0]?.name ?? "Turma"}</h3>
            <p>
              Curso: {student.activeMembership.cohort?.[0]?.course?.[0]?.title ?? "—"} ·{" "}
              {student.activeMembership.cohort?.[0]?.course?.[0]?.slug ?? ""}
            </p>
            <p>
              Professor principal:{" "}
              {student.primaryTeacher?.teacher?.[0]?.profile?.[0]?.display_name ?? "Não atribuído"}
            </p>
          </Card>
        ) : (
          <p>Sem coorte ativa no momento.</p>
        )}
      </section>
      <section className="yas-stack" aria-labelledby="student-enrollments-heading">
        <h2 id="student-enrollments-heading">Matrículas</h2>
        {student.enrollments.length === 0 ? (
          <p>Nenhuma matrícula registrada.</p>
        ) : (
          student.enrollments.map((enrollment) => (
            <Card key={enrollment.id}>
              <h3>{enrollment.course?.[0]?.title ?? "Curso"}</h3>
              <p>
                <Badge tone={enrollment.status === "ACTIVE" ? "success" : "info"}>
                  {enrollment.status}
                </Badge>
              </p>
              <p>
                Início: {date(enrollment.enrolled_at)} · Conclusão: {date(enrollment.completed_at)}
              </p>
            </Card>
          ))
        )}
      </section>
      <section className="yas-stack" aria-labelledby="student-curriculum-heading">
        <h2 id="student-curriculum-heading">Progresso curricular</h2>
        {student.curriculum.length === 0 ? (
          <p>Nenhum curso ativo com currículo publicado.</p>
        ) : (
          student.curriculum.map((course) => (
            <Card key={course.enrollment_id}>
              <h3>{course.course_title}</h3>
              <p>
                {course.lessons_completed}/{course.lessons_total} aulas concluídas ·{" "}
                {course.completion_percent}%
              </p>
              <p>Atividade recente: {date(course.latest_activity_at)}</p>
            </Card>
          ))
        )}
      </section>
      <section className="yas-stack" aria-labelledby="student-practice-heading">
        <h2 id="student-practice-heading">Practice</h2>
        {student.practice.length === 0 ? (
          <p>Nenhuma prática registrada.</p>
        ) : (
          student.practice.map((attempt) => (
            <Card key={attempt.id}>
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
            </Card>
          ))
        )}
      </section>
      <section className="yas-stack" aria-labelledby="student-attendance-heading">
        <h2 id="student-attendance-heading">Attendance</h2>
        {student.attendance.length === 0 ? (
          <p>Nenhuma sessão registrada.</p>
        ) : (
          student.attendance.map((booking) => (
            <Card key={booking.id}>
              <h3>{booking.session?.[0]?.title ?? "Sessão"}</h3>
              <p>
                {booking.status} · {booking.attendance?.[0]?.status ?? "Presença pendente"} ·{" "}
                {date(booking.session?.[0]?.starts_at ?? booking.booked_at)}
              </p>
            </Card>
          ))
        )}
      </section>
      <section className="yas-stack" aria-labelledby="student-assessments-heading">
        <h2 id="student-assessments-heading">Assessment</h2>
        {student.assessments.filter((attempt) => attempt.status === "SCORED" && attempt.scored_at)
          .length === 0 ? (
          <p>Nenhum resultado válido disponível.</p>
        ) : (
          student.assessments
            .filter((attempt) => attempt.status === "SCORED" && attempt.scored_at)
            .map((attempt) => (
              <Card key={attempt.id}>
                <h3>
                  {attempt.assessment?.[0]?.assessment?.[0]?.title ?? "Avaliação"} ·{" "}
                  {date(attempt.scored_at)}
                </h3>
                {attempt.result_cefr && <p>Nível registrado: {attempt.result_cefr}</p>}
                <ul>
                  {attempt.skills.map((skill) => (
                    <li key={skill.skill}>
                      {skill.skill}: {skill.score}/{skill.max_score ?? "—"}
                      {skill.cefr_level ? " · nível registrado " + skill.cefr_level : ""}
                    </li>
                  ))}
                </ul>
              </Card>
            ))
        )}
      </section>
      <section className="yas-stack" aria-labelledby="student-cohorts-heading">
        <h2 id="student-cohorts-heading">Turmas</h2>
        {student.memberships.length === 0 ? (
          <p>Nenhum vínculo de turma registrado.</p>
        ) : (
          student.memberships.map((membership) => (
            <Card key={membership.id}>
              <h3>{membership.cohort?.[0]?.name ?? "Turma"}</h3>
              <p>
                {membership.cohort?.[0]?.code ?? "—"} · {membership.status} ·{" "}
                {membership.cohort?.[0]?.status ?? "—"}
              </p>
              <p>
                Vínculo desde {date(membership.starts_at)} · Encerrado em {date(membership.ends_at)}
              </p>
            </Card>
          ))
        )}
      </section>
      <section className="yas-stack" aria-labelledby="student-placement-history-heading">
        <h2 id="student-placement-history-heading">Histórico de Placement</h2>
        {student.placement ? (
          <Card>
            <h3>{student.placement.state}</h3>
            <p>Caso iniciado em {date(student.placement.created_at)}</p>
            {student.placementReview && (
              <div>
                <h4>Recomendação histórica</h4>
                <p>
                  {student.placementReview.course?.[0]?.title ?? "Curso"} · confiança{" "}
                  {student.placementReview.confidence}
                </p>
                <p>{student.placementReview.feedback}</p>
                <p>Revisada em {date(student.placementReview.finalized_at)}</p>
              </div>
            )}
            {student.placementDecision && (
              <p>
                Escolha: {student.placementDecision.cohort?.[0]?.name ?? "Turma"} ·{" "}
                {student.placementDecision.course?.[0]?.title ?? "Curso"} ·{" "}
                {date(student.placementDecision.created_at)}
              </p>
            )}
            {student.placementTransfers.map((transfer) => (
              <p key={transfer.operation_id}>
                Transferência para {transfer.target?.[0]?.name ?? "Turma"} em{" "}
                {date(transfer.created_at)} · {transfer.reason}
              </p>
            ))}
          </Card>
        ) : (
          <p>Nenhum caso de Placement registrado.</p>
        )}
      </section>
      <section className="yas-stack" aria-labelledby="student-commercial-heading">
        <h2 id="student-commercial-heading">Acesso comercial</h2>
        {student.subscriptions.length === 0 ? (
          <p>Nenhum registro local de assinatura.</p>
        ) : (
          student.subscriptions.map((subscription, index) => (
            <Card key={subscription.status + subscription.started_at + index}>
              <h3>{subscription.status}</h3>
              <p>
                Período: {date(subscription.current_period_start ?? subscription.started_at)} ·{" "}
                {date(subscription.current_period_end ?? subscription.ended_at)}
              </p>
            </Card>
          ))
        )}
      </section>
      <section className="yas-stack" aria-labelledby="student-progress-heading">
        <h2 id="student-progress-heading">Atividade recente</h2>
        {student.recentProgress.length === 0 ? (
          <p>Nenhuma atividade de aula registrada.</p>
        ) : (
          student.recentProgress.map((activity) => (
            <Card key={activity.id}>
              <h3>{activity.lesson?.[0]?.title ?? "Aula"}</h3>
              <p>
                {activity.status} · último acesso {date(activity.last_accessed_at)}
              </p>
            </Card>
          ))
        )}
      </section>
    </div>
  );
}
