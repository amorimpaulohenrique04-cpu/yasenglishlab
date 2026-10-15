"use client";
import { useActionState, useState } from "react";
import { Alert, Button, Input, Select } from "@/components/ui";
import type { EnrollFormState } from "../domain/models";

export function EnrollNextCourseForm({
  userId,
  courses,
  cohorts,
  action,
}: {
  userId: string;
  courses: { id: string; title: string }[];
  cohorts: { id: string; name: string; courseId: string }[];
  action: (state: EnrollFormState, data: FormData) => Promise<EnrollFormState>;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [courseId, setCourseId] = useState(courses[0]?.id ?? "");
  const options = cohorts.filter((c) => c.courseId === courseId);
  if (courses.length === 0) return <p>Nenhum curso ativo e publicado disponível para matrícula.</p>;
  return (
    <form action={formAction} className="yas-stack">
      <input type="hidden" name="userId" value={userId} />
      {state.error && (
        <Alert tone="error" title="Não foi possível matricular" description={state.error} />
      )}
      {state.receipt && (
        <Alert
          tone="success"
          title="Matrícula registrada"
          description={`Recibo da operação ${state.receipt.operationId}. Situação: ${state.receipt.enrollmentStatus === "ACTIVE" ? "ativa" : state.receipt.enrollmentStatus}${state.receipt.reusedMembership ? ". O aluno já estava na turma; o vínculo foi reaproveitado." : "."}`}
        />
      )}
      <Select
        label="Curso"
        name="courseId"
        value={courseId}
        onChange={(e) => setCourseId(e.target.value)}
        options={courses.map((c) => ({ value: c.id, label: c.title }))}
      />
      <Select
        key={courseId}
        label="Turma ativa do curso"
        name="cohortId"
        required
        {...(options.length ? {} : { message: "Este curso não tem turma ativa." })}
        options={options.map((c) => ({ value: c.id, label: c.name }))}
      />
      <Input label="Motivo da matrícula" name="reason" required maxLength={1000} />
      <div>
        <Button type="submit" loading={pending} disabled={options.length === 0}>
          Matricular no curso
        </Button>
      </div>
    </form>
  );
}
