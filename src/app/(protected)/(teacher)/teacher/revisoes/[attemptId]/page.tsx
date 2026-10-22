import { notFound } from "next/navigation";
import { Alert, Badge, Button, Card, PageHeader } from "@/components/ui";
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
          className="yas-split-layout"
          data-aside="review"
        >
          <div className="yas-split-main">
            <div className="yas-review-head">
              {items.length > 1 && <h2>Pergunta {index + 1}</h2>}
              <Badge tone={item.status === "PENDING_MANUAL" ? "warning" : "success"} dot>
                {item.status === "PENDING_MANUAL" ? "Aguardando revisão" : "Revisão finalizada"}
              </Badge>
              <span className="yas-drawer-meta">{item.studentName ?? "Aluno"}</span>
            </div>
            <Card className="yas-review-answer">
              <p>
                <strong>{item.prompt}</strong>
              </p>
              {typeof item.response.mediaId === "string" && (
                <AudioPlayback id={item.response.mediaId} action={teacherAudioPlaybackAction} />
              )}
              {typeof item.response.text === "string" && (
                <blockquote className="yas-quote">{item.response.text}</blockquote>
              )}
            </Card>
          </div>
          <div className="yas-split-aside" data-sticky="">
            {item.status === "PENDING_MANUAL" ? (
              <Card>
                <form action={reviewPracticeAction} className="yas-review-form">
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
          </div>
        </section>
      ))}
    </div>
  );
}
