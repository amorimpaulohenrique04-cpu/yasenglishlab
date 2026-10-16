import { notFound } from "next/navigation";
import { Alert, Button, Card, PageHeader } from "@/components/ui";
import {
  RUBRIC_LABELS,
  RUBRIC_LEVELS,
  rubricDimensionsFor,
} from "@/modules/practice/domain/rubric";
import { AudioPlayback } from "@/modules/practice/ui/audio-playback";
import { loadTeacherReviews } from "@/server/teacher-operations/pedagogy";
import styles from "@/modules/teacher-operations/ui/teacher-operations.module.css";
import { reviewPracticeAction, teacherAudioPlaybackAction } from "../actions";
export default async function ReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ attemptId: string }>;
  searchParams: Promise<{ save?: string }>;
}) {
  const { attemptId } = await params;
  const items = await loadTeacherReviews(attemptId);
  const [first] = items;
  if (!first) notFound();
  return (
    <div className={styles.page}>
      <PageHeader title={first.title} description={`Resposta de ${first.studentName ?? "Aluno"}`} />
      {(await searchParams).save === "error" && (
        <Alert
          tone="error"
          title="Revisão rejeitada"
          description="O vínculo pode ter mudado ou outro professor já concluiu esta revisão."
        />
      )}
      {items.map((item, index) => (
        <section
          key={item.itemId ?? item.id}
          aria-label={items.length > 1 ? `Pergunta ${index + 1} de ${items.length}` : undefined}
          className={styles.page}
        >
          {items.length > 1 && <h2>Pergunta {index + 1}</h2>}
          <Card>
            <p>{item.prompt}</p>
            {typeof item.response.text === "string" && <p>{item.response.text}</p>}
            {typeof item.response.mediaId === "string" && (
              <AudioPlayback id={item.response.mediaId} action={teacherAudioPlaybackAction} />
            )}
          </Card>
          {item.status === "PENDING_MANUAL" ? (
            <Card>
              <form action={reviewPracticeAction} className={styles.operationForm}>
                <input type="hidden" name="attemptId" value={item.id} />
                <input type="hidden" name="skill" value={item.skill} />
                {item.itemId && <input type="hidden" name="itemId" value={item.itemId} />}
                {item.responseType && (
                  <input type="hidden" name="responseType" value={item.responseType} />
                )}
                {rubricDimensionsFor(item.skill, item.responseType).map((dimension) => (
                  <label key={dimension}>
                    {RUBRIC_LABELS[dimension]}
                    <select name={dimension} required defaultValue="">
                      <option value="" disabled>
                        Selecione um nível
                      </option>
                      {RUBRIC_LEVELS.map((level) => (
                        <option key={level} value={level}>
                          {RUBRIC_LABELS[level]}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
                <label>
                  Feedback ao aluno
                  <textarea name="feedback" required maxLength={4000} rows={6} />
                </label>
                <Button type="submit">Finalizar revisão</Button>
              </form>
            </Card>
          ) : (
            <p>Revisão finalizada. O feedback já está disponível ao aluno.</p>
          )}
        </section>
      ))}
    </div>
  );
}
