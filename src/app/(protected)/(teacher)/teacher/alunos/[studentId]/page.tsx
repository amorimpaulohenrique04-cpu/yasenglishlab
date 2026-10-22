import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  Textarea,
  PageHeader,
  SectionHeader,
} from "@/components/ui";
import { loadTeacherOperationContext } from "@/server/teacher-operations/operation-context";
import { loadTeacherStudentProjection } from "@/server/teacher-operations/student-projection";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { createNoteAction, requestReassessmentAction } from "../actions";
export default async function TeacherStudentPage({
  params,
  searchParams,
}: {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<{ save?: string }>;
}) {
  const id = z.uuid().parse((await params).studentId);
  const context = await loadTeacherOperationContext();
  const student = context.students.find((item) => item.id === id);
  if (!student) notFound();
  const client = await createSupabaseServerClient();
  const projection = await loadTeacherStudentProjection({
    studentId: id,
    sessionIds: context.sessions.map((session) => session.id),
  });
  const { data: notes, error } = await client
    .from("teacher_student_notes")
    .select("id,body,created_at")
    .eq("student_user_id", id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error("Notas indisponíveis.");
  const { data: reassessments } = await client
    .from("reassessment_requests")
    .select("id,reason,status,created_at,resolution_note")
    .eq("student_user_id", id)
    .order("created_at", { ascending: false })
    .limit(10);
  const openReassessment = reassessments?.find((item) => item.status === "OPEN");
  return (
    <>
      <Link className="yas-back-link" href="/teacher/alunos">
        Voltar para alunos
      </Link>
      <PageHeader
        title={student.name ?? "Aluno"}
        description="Acompanhamento pedagógico e notas internas."
      />
      <section className="yas-profile-card" aria-label="Resumo do aluno">
        <Avatar
          fallback={(student.name ?? "Aluno")
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part[0]?.toUpperCase())
            .join("")}
          label={student.name ?? "Aluno"}
          size="lg"
        />
        <div className="yas-profile-card-main">
          <div className="yas-cluster">
            <Badge
              tone={
                projection.enrollments.some((item) => item.status === "ACTIVE")
                  ? "success"
                  : "neutral"
              }
            >
              {projection.enrollments.some((item) => item.status === "ACTIVE")
                ? "Matrícula ativa"
                : "Sem matrícula ativa"}
            </Badge>
            {openReassessment && <Badge tone="warning">Novo teste solicitado</Badge>}
          </div>
        </div>
      </section>
      {(await searchParams).save === "error" && (
        <Alert
          tone="error"
          title="Nota rejeitada"
          description="Confira seu vínculo com este aluno."
        />
      )}
      {(await searchParams).save === "reassessment" && (
        <Alert
          tone="success"
          title="Pedido registrado"
          description="A equipe vai avaliar o pedido. O curso e a turma do aluno não mudam."
        />
      )}
      <Card className="yas-stack">
        <SectionHeader title="Pedir novo teste" />
        <p>
          O pedido fica no histórico e não substitui o resultado anterior. Ele não inicia um teste
          nem muda o curso do aluno.
        </p>
        {openReassessment ? (
          <p>
            Pedido em aberto desde{" "}
            {new Date(openReassessment.created_at).toLocaleDateString("pt-BR", {
              timeZone: "America/Recife",
            })}
            : {openReassessment.reason}
          </p>
        ) : (
          <form action={requestReassessmentAction} className="yas-stack">
            <input type="hidden" name="studentId" value={id} />
            <Textarea
              name="reason"
              label="Justificativa (10 a 1000 caracteres)"
              required
              minLength={10}
              maxLength={1000}
            />
            <Button type="submit">Pedir novo teste</Button>
          </form>
        )}
        {(reassessments ?? [])
          .filter((item) => item.status === "RESOLVED")
          .map((item) => (
            <p key={item.id}>
              Tratado em {new Date(item.created_at).toLocaleDateString("pt-BR")}: {item.reason} —{" "}
              {item.resolution_note}
            </p>
          ))}
      </Card>
      <Card>
        <SectionHeader title="Matrículas e trilhas" />
        {projection.enrollments.length ? (
          <ul>
            {projection.enrollments.map((item) => (
              <li key={item.id}>
                {item.course} ·{" "}
                {item.status === "ACTIVE"
                  ? "Ativa"
                  : item.status === "COMPLETED"
                    ? "Concluída"
                    : "Encerrada"}
              </li>
            ))}
          </ul>
        ) : (
          <p>Sem matrícula registrada.</p>
        )}
      </Card>
      <Card>
        <SectionHeader title="Progresso curricular" />
        <p>
          {projection.progress.completed} de {projection.progress.total} lições concluídas na
          amostra · média {projection.progress.average}%.
        </p>
        <p>Este indicador descreve progresso do curso, não proficiência CEFR.</p>
      </Card>
      <Card>
        <SectionHeader title="Practice" />
        {projection.practice.length ? (
          <ul>
            {projection.practice.map((item) => (
              <li key={item.id}>
                {item.activity} ·{" "}
                {item.status === "SUBMITTED"
                  ? "Enviada"
                  : item.status === "IN_PROGRESS"
                    ? "Em andamento"
                    : "Abandonada"}
                {item.result
                  ? ` · ${item.result.evaluation_status === "PENDING_MANUAL" ? "Revisão pendente" : item.result.evaluation_status === "MANUAL_REVIEWED" ? "Revisada" : item.result.evaluation_status}`
                  : ""}
                {item.result?.evaluation_status === "PENDING_MANUAL" && (
                  <a href={`/teacher/revisoes/${item.id}`}> Revisar Practice</a>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p>Sem práticas recentes.</p>
        )}
      </Card>
      <Card>
        <SectionHeader title="Presença" />
        {projection.attendance.length ? (
          <ul>
            {projection.attendance.map((item, index) => (
              <li key={`${item.marked_at}-${index}`}>
                {item.status === "ATTENDED" ? "Presente" : "Falta registrada"} ·{" "}
                {new Date(item.marked_at).toLocaleDateString("pt-BR", {
                  timeZone: "America/Recife",
                })}
              </li>
            ))}
          </ul>
        ) : (
          <p>Sem presenças registradas nas sessões visíveis.</p>
        )}
      </Card>
      <Card>
        <SectionHeader title="Avaliações" />
        {projection.assessments.length ? (
          <ul>
            {projection.assessments.map((item) => (
              <li key={item.id}>
                Avaliação pontuada ·{" "}
                {item.scored_at
                  ? new Date(item.scored_at).toLocaleDateString("pt-BR", {
                      timeZone: "America/Recife",
                    })
                  : "data indisponível"}
                {item.result_cefr ? ` · Resultado registrado: ${item.result_cefr}` : ""}
              </li>
            ))}
          </ul>
        ) : (
          <p>Sem resultados de avaliação válidos.</p>
        )}
      </Card>
      <Card>
        <SectionHeader title="Placement" />
        {projection.placement ? (
          <>
            <Badge tone="info">{projection.placement.state}</Badge>
            {projection.placement.review && (
              <p>
                Recomendação histórica registrada · confiança{" "}
                {projection.placement.review.confidence}: {projection.placement.review.feedback}
              </p>
            )}
            {projection.placement.decision && (
              <p>Turma escolhida: {projection.placement.decision.chosen_cohort_id}</p>
            )}
          </>
        ) : (
          <p>Sem processo de Placement visível.</p>
        )}
      </Card>
      <Card>
        <SectionHeader title="Sessões e atividades" />
        {projection.bookings.length ? (
          <ul>
            {projection.bookings.map((booking) => {
              const session = context.sessions.find((item) => item.id === booking.live_session_id);
              return (
                <li key={booking.id}>
                  {session ? (
                    <a href={`/teacher/sessoes/${session.id}`}>{session.title}</a>
                  ) : (
                    "Sessão"
                  )}{" "}
                  · {booking.status}
                </li>
              );
            })}
          </ul>
        ) : (
          <p>Sem reservas em sessões visíveis.</p>
        )}
        <h3>Homework</h3>
        {projection.homework.length ? (
          <ul>
            {projection.homework.map((item) => (
              <li key={item.id}>
                {item.title}
                {item.due_at
                  ? ` · prazo ${new Date(item.due_at).toLocaleString("pt-BR", { timeZone: "America/Recife" })}`
                  : ""}
                <p>{item.instructions}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p>Sem homework nas sessões próprias visíveis.</p>
        )}
      </Card>
      <Card>
        <SectionHeader title="Nota interna" />
        <form action={createNoteAction}>
          <input name="studentId" type="hidden" value={id} />
          <Textarea label="Nota interna" name="body" required maxLength={4000} />
          <p>Esta nota não é enviada ao aluno.</p>
          <Button type="submit">Salvar nota</Button>
        </form>
      </Card>
      {notes?.map((note) => (
        <Card key={note.id}>
          <p>{note.body}</p>
          <time dateTime={note.created_at}>
            {new Date(note.created_at).toLocaleString("pt-BR", { timeZone: "America/Recife" })}
          </time>
        </Card>
      ))}
    </>
  );
}
