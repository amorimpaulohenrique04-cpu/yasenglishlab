import { notFound } from "next/navigation";
import { z } from "zod";
import { Alert, Button, Card, Textarea, PageHeader } from "@/components/ui";
import { loadTeacherOperationContext } from "@/server/teacher-operations/operation-context";
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
  const { data: notes, error } = await client
    .from("teacher_student_notes")
    .select("id,body,created_at")
    .eq("student_user_id", id)
    .order("created_at", { ascending: false });
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
