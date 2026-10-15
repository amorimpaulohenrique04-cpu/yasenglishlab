import Link from "next/link";
import type { CSSProperties } from "react";

import {
  Alert,
  Badge,
  Card,
  EmptyState,
  ErrorState,
  Icon,
  IconBadge,
  PageHeader,
  ProgressBar,
  ProgressRing,
  type IconName,
} from "@/components/ui";
import {
  skillDisplayRatio,
  type ProgressAssessmentView,
  type ProgressAttendanceView,
  type ProgressConsistencyView,
  type ProgressCurriculumView,
  type ProgressHistoryEvent,
  type ProgressHistoryKind,
  type ProgressPracticeView,
  type ProgressSection,
  type ProgressSkillSummary,
} from "@/modules/progress";
import { SubscriptionSuspendedNotice } from "@/modules/billing/ui/suspension-notice";
import { loadCurrentSubscriptionAccess } from "@/server/billing/subscription-access";
import { loadProgressPage } from "@/server/progress/progress";

const reveal = (index: number) => ({ "--yas-i": index }) as CSSProperties;

const skillLabels: Record<ProgressSkillSummary["skill"] | "WRITING", string> = {
  READING: "Reading",
  LISTENING: "Listening",
  SPEAKING: "Speaking",
  VOCABULARY: "Vocabulário",
  GRAMMAR: "Gramática",
  PRONUNCIATION: "Pronúncia",
  WRITING: "Escrita",
};

const skillIcons: Record<ProgressSkillSummary["skill"] | "WRITING", IconName> = {
  READING: "book",
  LISTENING: "headphones",
  SPEAKING: "chat",
  VOCABULARY: "book",
  GRAMMAR: "grad",
  PRONUNCIATION: "mic",
  WRITING: "pen",
};

const historyIcons: Record<ProgressHistoryKind, IconName> = {
  lesson_completed: "play-sq",
  practice_submitted: "headphones",
  attendance_marked: "users",
  assessment_submitted: "file",
  assessment_scored: "check-c",
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function practiceStatusLabel(item: ProgressPracticeView["recent"][number]): string {
  if (item.status === "IN_PROGRESS") return "Em andamento";
  if (item.status === "ABANDONED") return "Interrompida";
  if (item.evaluationStatus === "CORRECT") return "Resposta correta";
  if (item.evaluationStatus === "INCORRECT") return "Resposta incorreta";
  if (item.evaluationStatus === "PENDING_MANUAL") return "Pendente de avaliação manual";
  return "Concluída";
}

function SectionTitle({ id, title, children }: { id: string; title: string; children?: string }) {
  return (
    <div className="yas-progress-section-heading">
      <h2 id={id}>{title}</h2>
      {children && <p>{children}</p>}
    </div>
  );
}

function SkillRow({ item }: { item: ProgressSkillSummary }) {
  const ratio = skillDisplayRatio(item.score, item.maxScore);
  return (
    <li className="yas-progress-skill">
      <Icon name={skillIcons[item.skill]} size={18} />
      <strong>{skillLabels[item.skill]}</strong>
      {ratio !== null ? (
        <ProgressBar value={ratio} label="Pontuação desta avaliação" showValue={false} />
      ) : (
        <span className="yas-progress-skill-empty">Ainda sem avaliação objetiva</span>
      )}
      <span className="yas-progress-skill-value">
        {item.score === null
          ? "—"
          : item.maxScore === null
            ? `${item.score} pts`
            : `${item.score}/${item.maxScore}`}
      </span>
    </li>
  );
}

function ProficiencyCard({
  message,
  assessment,
}: {
  message: string;
  assessment: ProgressSection<ProgressAssessmentView>;
}) {
  return (
    <Card
      className="yas-progress-proficiency yas-reveal"
      style={reveal(1)}
      aria-labelledby="progress-assessment-title"
    >
      <div className="yas-card-header">
        <h2 className="yas-card-title" id="progress-assessment-title">
          Proficiência e habilidades
        </h2>
        <Badge tone="muted">Nível vem do teste revisado</Badge>
      </div>
      <div className="yas-progress-proficiency-grid">
        <div className="yas-progress-level">
          <span className="yas-progress-muted">Seu nível atual</span>
          <span className="yas-progress-level-value" aria-hidden="true">
            —
          </span>
          <h3>Nível CEFR ainda não disponível</h3>
          <p className="yas-progress-muted">{message}</p>
        </div>
        <div>
          <b className="yas-progress-subtitle">Desempenho por habilidade</b>
          {assessment.status === "error" ? (
            <Alert tone="error" title="Avaliações indisponíveis" description={assessment.message} />
          ) : (
            <>
              <ul className="yas-progress-skills">
                {assessment.data.skills.map((item) => (
                  <SkillRow key={item.skill} item={item} />
                ))}
              </ul>
              {assessment.status === "empty" && (
                <p className="yas-progress-muted">
                  Você ainda não possui uma avaliação objetiva registrada.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

function ConsistencyCard({ section }: { section: ProgressSection<ProgressConsistencyView> }) {
  return (
    <Card
      className="yas-progress-consistency yas-reveal"
      style={reveal(2)}
      aria-labelledby="progress-consistency-title"
    >
      <div className="yas-card-header">
        <h2 className="yas-card-title" id="progress-consistency-title">
          Sua consistência
        </h2>
        <span className="yas-progress-muted">últimos 7 dias</span>
      </div>
      {section.status === "error" ? (
        <Alert tone="error" title="Consistência indisponível" description={section.message} />
      ) : (
        <>
          <div className="yas-progress-active-days">
            <ProgressRing
              value={(section.data.activeDaysLast7Days / 7) * 100}
              size={92}
              stroke={12}
              tone="priority"
              label={`${section.data.activeDaysLast7Days} de 7 dias com atividade`}
            >
              <span>
                {section.data.activeDaysLast7Days}
                <small>de 7</small>
              </span>
            </ProgressRing>
            <div>
              <strong>{section.data.activeDaysLast7Days} dias ativos</strong>
              <p className="yas-progress-muted">
                Contamos os dias em que você concluiu uma aula, uma prática ou participou de um
                encontro.
              </p>
            </div>
          </div>
          <ul className="yas-list yas-progress-consistency-list">
            <li>
              <IconBadge icon="play-sq" shape="square" size="sm" />
              <b>{section.data.lessonsCompletedLast7Days}</b>
              <span>aulas concluídas</span>
            </li>
            <li>
              <IconBadge icon="headphones" tone="yellow" shape="square" size="sm" />
              <b>{section.data.practicesCompletedLast7Days}</b>
              <span>práticas concluídas</span>
            </li>
            <li>
              <IconBadge icon="users" tone="blue" shape="square" size="sm" />
              <b>{section.data.attendedLast7Days}</b>
              <span>presenças em encontros</span>
            </li>
          </ul>
        </>
      )}
    </Card>
  );
}

function CurriculumSection({ section }: { section: ProgressSection<ProgressCurriculumView> }) {
  return (
    <section className="yas-progress-section" aria-labelledby="progress-curriculum-title">
      <SectionTitle id="progress-curriculum-title" title="Progresso no curso" />
      {section.status === "error" ? (
        <Alert tone="error" title="Currículo indisponível" description={section.message} />
      ) : section.status === "empty" ? (
        <Card>
          <EmptyState
            title="Nenhum curso ativo"
            description="Quando houver uma matrícula ativa, o avanço curricular aparecerá aqui."
          />
        </Card>
      ) : (
        <div className="yas-progress-course-list">
          {section.data.courses.map((course) => (
            <Card className="yas-progress-course" key={course.id}>
              <IconBadge icon="book" shape="square" size="lg" />
              <div className="yas-progress-course-title">
                <h3>{course.title}</h3>
                <span className="yas-progress-muted">
                  {course.lessonsCompleted} de {course.totalLessons} aulas ·{" "}
                  {course.modulesCompleted} de {course.totalModules} módulos
                </span>
                {course.completedAt && (
                  <Badge tone="success" icon="trophy">
                    Curso concluído
                  </Badge>
                )}
              </div>
              <div className="yas-progress-course-bar">
                <ProgressBar
                  value={course.completionPercent}
                  label="Conclusão do curso"
                  showValue={false}
                />
                <b>{course.completionPercent}%</b>
              </div>
              <Link className="yas-link" href="/aulas">
                Ver curso <Icon name="arrow" />
              </Link>
              {course.lastActivityAt && (
                <small className="yas-progress-course-foot">
                  Última atividade no curso: {formatDate(course.lastActivityAt)}
                </small>
              )}
            </Card>
          ))}
          {section.data.courses.every((course) => Boolean(course.completedAt)) && (
            <p className="yas-progress-muted" role="status">
              Curso concluído. A equipe vai indicar seu próximo passo.{" "}
              <Link className="yas-link" href="/support">
                Falar com o suporte
              </Link>
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function PracticeSection({ section }: { section: ProgressSection<ProgressPracticeView> }) {
  return (
    <Card className="yas-progress-panel" aria-labelledby="progress-practice-title">
      <div className="yas-card-header">
        <h2 className="yas-card-title" id="progress-practice-title">
          Prática
        </h2>
        {section.status === "success" && (
          <Link className="yas-link" href="/pratica">
            Ver práticas <Icon name="arrow" />
          </Link>
        )}
      </div>
      {section.status === "error" ? (
        <Alert tone="error" title="Prática indisponível" description={section.message} />
      ) : section.status === "empty" ? (
        <EmptyState
          title="Ainda sem práticas"
          description="Suas práticas enviadas aparecem aqui. Elas não mudam o seu nível CEFR."
        />
      ) : (
        <>
          <dl className="yas-progress-stats">
            <div>
              <dt>Concluídas em 7 dias</dt>
              <dd>{section.data.completedLast7Days}</dd>
            </div>
            <div>
              <dt>Tempo estimado</dt>
              <dd>
                {section.data.minutesLast7Days}
                <small> min</small>
              </dd>
            </div>
          </dl>
          <ol className="yas-list">
            {section.data.recent.slice(0, 4).map((item) => (
              <li key={item.attemptId}>
                <span className="yas-list-text">
                  <strong>{item.activityTitle}</strong>
                  <small>
                    {item.submittedAt ? formatDate(item.submittedAt) : formatDate(item.startedAt)}
                    {" · "}
                    {skillLabels[item.skill]}
                  </small>
                </span>
                <Badge
                  tone={
                    item.evaluationStatus === "CORRECT"
                      ? "success"
                      : item.evaluationStatus === "PENDING_MANUAL"
                        ? "warning"
                        : "muted"
                  }
                >
                  {practiceStatusLabel(item)}
                </Badge>
              </li>
            ))}
          </ol>
        </>
      )}
    </Card>
  );
}

function AttendanceSection({ section }: { section: ProgressSection<ProgressAttendanceView> }) {
  return (
    <Card className="yas-progress-panel" aria-labelledby="progress-attendance-title">
      <div className="yas-card-header">
        <h2 className="yas-card-title" id="progress-attendance-title">
          Encontros ao vivo
        </h2>
        {section.status === "success" && (
          <Link className="yas-link" href="/agenda">
            Ver agenda <Icon name="arrow" />
          </Link>
        )}
      </div>
      {section.status === "error" ? (
        <Alert tone="error" title="Participação indisponível" description={section.message} />
      ) : section.status === "empty" ? (
        <EmptyState
          title="Ainda sem encontros"
          description="Suas reservas e presenças aparecem aqui depois dos encontros."
        />
      ) : (
        <>
          <dl className="yas-progress-stats yas-progress-stats--four">
            <div>
              <dt>Presenças</dt>
              <dd>{section.data.attended}</dd>
            </div>
            <div>
              <dt>Ausências</dt>
              <dd>{section.data.noShow}</dd>
            </div>
            <div>
              <dt>Chamada pendente</dt>
              <dd>{section.data.pending}</dd>
            </div>
            <div>
              <dt>Cancelados</dt>
              <dd>{section.data.cancelled}</dd>
            </div>
          </dl>
          {section.data.attendanceRatePercent !== null && (
            <ProgressBar
              value={section.data.attendanceRatePercent}
              label="Presença em encontros com chamada registrada"
              tone="success"
            />
          )}
        </>
      )}
    </Card>
  );
}

function HistorySection({ section }: { section: ProgressSection<ProgressHistoryEvent[]> }) {
  return (
    <Card className="yas-progress-panel" aria-labelledby="progress-history-title">
      <div className="yas-card-header">
        <h2 className="yas-card-title" id="progress-history-title">
          Histórico
        </h2>
      </div>
      {section.status === "error" ? (
        <Alert tone="error" title="Histórico indisponível" description={section.message} />
      ) : section.status === "empty" ? (
        <EmptyState
          title="Ainda sem histórico"
          description="Conclusões, práticas, chamadas e avaliações aparecerão aqui quando ocorrerem."
        />
      ) : (
        <ol className="yas-progress-timeline">
          {section.data.map((event) => (
            <li key={event.id}>
              <IconBadge icon={historyIcons[event.kind]} shape="square" size="sm" />
              <div>
                <strong>{event.title}</strong>
                <small>
                  {event.detail} ·{" "}
                  <time dateTime={event.occurredAt}>{formatDate(event.occurredAt)}</time>
                </small>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

export default async function ProgressPage() {
  const state = await loadProgressPage();
  // ADR 0016 §2: suspension never hides or alters progress; the notice only explains paused access. A
  // billing read failure must not break this page, so it simply omits the notice.
  const access =
    state.status === "unauthorized" || state.status === "error"
      ? ({ kind: "ok" } as const)
      : await loadCurrentSubscriptionAccess().catch(() => ({ kind: "ok" }) as const);
  const notice = <SubscriptionSuspendedNotice access={access} context="progress" />;

  if (state.status === "unauthorized") {
    return (
      <div className="yas-progress-page">
        <PageHeader title="Progresso" description="Entenda como sua jornada está avançando." />
        <ErrorState
          title="Acesso não autorizado"
          description="Esta área é exclusiva para contas de aluno."
        />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="yas-progress-page">
        <PageHeader title="Progresso" description="Entenda como sua jornada está avançando." />
        <ErrorState
          title="Não foi possível carregar seu progresso"
          description="Seus dados continuam salvos. Tente novamente em alguns minutos."
        />
      </div>
    );
  }

  if (state.status === "empty") {
    return (
      <div className="yas-progress-page">
        <PageHeader
          title="Progresso"
          description="Entenda como sua jornada está avançando."
          tagline
        />
        {notice}
        <EmptyState
          title="Seu progresso começa aqui"
          description="Quando você tiver cursos, práticas, encontros ou avaliações registrados, os fatos aparecerão nesta página."
        />
      </div>
    );
  }

  const { data } = state;

  return (
    <div className="yas-progress-page">
      <PageHeader
        title="Progresso"
        description="Acompanhe sua evolução, seu nível e seu desempenho no inglês."
        tagline
      />

      {notice}

      {state.status === "partial" && (
        <Alert
          tone="warning"
          title="Algumas informações estão temporariamente indisponíveis"
          description="As seções disponíveis continuam válidas; nenhum dado ausente foi transformado em zero."
        />
      )}

      <div className="yas-progress-top">
        <ProficiencyCard message={data.cefr.message} assessment={data.assessment} />
        <ConsistencyCard section={data.consistency} />
      </div>

      <p className="yas-progress-info-line">
        <Icon name="spark" size={18} />O progresso no curso mostra aulas concluídas. Ele não muda
        seu nível: o nível vem do teste revisado pela professora.
      </p>

      <CurriculumSection section={data.curriculum} />

      <div className="yas-progress-two-column">
        <PracticeSection section={data.practice} />
        <AttendanceSection section={data.attendance} />
      </div>

      <HistorySection section={data.history} />
    </div>
  );
}
