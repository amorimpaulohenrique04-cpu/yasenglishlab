import { notFound } from "next/navigation";
import { z } from "zod";
import { Alert, Badge, Button, Card, Textarea, PageHeader, SectionHeader } from "@/components/ui";
import { loadTeacherOperationContext } from "@/server/teacher-operations/operation-context";
import { loadTeacherStudentProjection } from "@/server/teacher-operations/student-projection";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { createNoteAction } from "../actions";
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
  return (
    <>
      <PageHeader
        title={student.name ?? "Aluno"}
        description="Acompanhamento pedagógico e notas internas."
      />
      {(await searchParams).save === "error" && (
        <Alert
          tone="error"
          title="Nota rejeitada"
          description="Confira seu vínculo com este aluno."
        />
      )}
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
