import Link from "next/link";

import {
  Alert,
  Badge,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  ProgressBar,
  SectionHeader,
} from "@/components/ui";
import {
  skillDisplayRatio,
  type ProgressAssessmentView,
  type ProgressAttendanceView,
  type ProgressCurriculumView,
  type ProgressHistoryEvent,
  type ProgressPracticeView,
  type ProgressSection,
  type ProgressSkillSummary,
} from "@/modules/progress";
import { loadProgressPage } from "@/server/progress/progress";

const skillLabels: Record<ProgressSkillSummary["skill"], string> = {
  READING: "Reading",
  LISTENING: "Listening",
  SPEAKING: "Speaking",
  VOCABULARY: "Vocabulário",
  GRAMMAR: "Gramática",
  PRONUNCIATION: "Pronúncia",
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

function CurriculumSection({
  section,
}: {
  section: ProgressSection<ProgressCurriculumView>;
}) {
  return (
    <section className="yas-progress-section" aria-labelledby="progress-curriculum-title">
      <SectionHeader
        title="Progresso curricular"
        description="Cada curso mantém seu próprio percentual de conclusão."
      />
      <span id="progress-curriculum-title" className="sr-only">
        Progresso curricular
      </span>
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
            <Card key={course.id}>
              <div className="yas-progress-card-stack">
                <div className="yas-progress-card-heading">
                  <div>
                    <span className="yas-progress-eyebrow">Curso</span>
                    <h3>{course.title}</h3>
                  </div>
                  <strong>{course.completionPercent}%</strong>
                </div>
                <ProgressBar
                  value={course.completionPercent}
                  label="Conclusão do curso"
                  showValue={false}
                />
                <dl className="yas-progress-stats yas-progress-stats--compact">
                  <div>
                    <dt>Aulas concluídas</dt>
                    <dd>
                      {course.lessonsCompleted}/{course.totalLessons}
                    </dd>
                  </div>
                  <div>
                    <dt>Módulos concluídos</dt>
                    <dd>
                      {course.modulesCompleted}/{course.totalModules}
                    </dd>
                  </div>
                </dl>
                {course.lastActivityAt && (
                  <small>Atividade curricular mais recente: {formatDate(course.lastActivityAt)}</small>
                )}
                <Link className="yas-progress-link yas-focusable" href={`/aulas/${course.slug}`}>
                  Ver curso →
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

function PracticeSection({ section }: { section: ProgressSection<ProgressPracticeView> }) {
  return (
    <section className="yas-progress-section" aria-labelledby="progress-practice-title">
      <SectionHeader
        title="Prática"
        description="Resultados de prática continuam separados de proficiência."
      />
      <span id="progress-practice-title" className="sr-only">
        Prática
      </span>
      {section.status === "error" ? (
        <Alert tone="error" title="Prática indisponível" description={section.message} />
      ) : section.status === "empty" ? (
        <Card>
          <EmptyState
            title="Ainda sem práticas"
            description="Tentativas submetidas aparecerão aqui sem serem convertidas em nível CEFR."
          />
        </Card>
      ) : (
        <Card>
          <div className="yas-progress-card-stack">
            <dl className="yas-progress-stats">
              <div>
                <dt>Últimos 7 dias</dt>
                <dd>{section.data.completedLast7Days} concluídas</dd>
              </div>
              <div>
                <dt>Tempo estimado</dt>
                <dd>{section.data.minutesLast7Days} min</dd>
              </div>
            </dl>
            <ol className="yas-progress-list">
              {section.data.recent.slice(0, 4).map((item) => (
                <li key={item.attemptId}>
                  <div>
                    <strong>{item.activityTitle}</strong>
                    <small>
                      {item.submittedAt ? formatDate(item.submittedAt) : formatDate(item.startedAt)}
                      {" · "}
                      {skillLabels[item.skill]}
                    </small>
                  </div>
                  <Badge
                    tone={
                      item.evaluationStatus === "CORRECT"
                        ? "success"
                        : item.evaluationStatus === "PENDING_MANUAL"
                          ? "info"
                          : "neutral"
                    }
                  >
                    {practiceStatusLabel(item)}
                  </Badge>
                </li>
              ))}
            </ol>
            <Link className="yas-progress-link yas-focusable" href="/pratica">
              Ver práticas →
            </Link>
          </div>
        </Card>
      )}
    </section>
  );
}

function AttendanceSection({ section }: { section: ProgressSection<ProgressAttendanceView> }) {
  return (
    <section className="yas-progress-section" aria-labelledby="progress-attendance-title">
      <SectionHeader
        title="Encontros ao vivo"
        description="Presença, ausência e chamada pendente são estados diferentes."
      />
      <span id="progress-attendance-title" className="sr-only">
        Encontros ao vivo
      </span>
      {section.status === "error" ? (
        <Alert tone="error" title="Participação indisponível" description={section.message} />
      ) : section.status === "empty" ? (
        <Card>
          <EmptyState
            title="Ainda sem encontros"
            description="Reservas e chamadas registradas aparecerão aqui quando existirem."
          />
        </Card>
      ) : (
        <Card>
          <div className="yas-progress-card-stack">
            <dl className="yas-progress-stats">
              <div>
                <dt>Presenças</dt>
                <dd>{section.data.attended}</dd>
              </div>
              <div>
                <dt>Ausências registradas</dt>
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
              />
            )}
            <Link className="yas-progress-link yas-focusable" href="/agenda">
              Ver agenda →
            </Link>
          </div>
        </Card>
      )}
    </section>
  );
}

function SkillRow({ item }: { item: ProgressSkillSummary }) {
  const ratio = skillDisplayRatio(item.score, item.maxScore);
  return (
    <li>
      <div className="yas-progress-skill-heading">
        <strong>{skillLabels[item.skill]}</strong>
        <span>
          {item.score === null
            ? "Ainda sem avaliação objetiva"
            : item.maxScore === null
              ? `${item.score} pontos`
              : `${item.score}/${item.maxScore}`}
        </span>
      </div>
      {ratio !== null && (
        <ProgressBar
          value={ratio}
          label="Pontuação desta avaliação"
          showValue={false}
        />
      )}
    </li>
  );
}

function AssessmentSection({
  section,
}: {
  section: ProgressSection<ProgressAssessmentView>;
}) {
  return (
    <section className="yas-progress-section" aria-labelledby="progress-assessment-title">
      <SectionHeader
        title="Habilidades"
        description="Somente pontuações objetivas realmente registradas em avaliações."
      />
      <span id="progress-assessment-title" className="sr-only">
        Habilidades
      </span>
      {section.status === "error" ? (
        <Alert tone="error" title="Avaliações indisponíveis" description={section.message} />
      ) : (
        <Card>
          <ul className="yas-progress-skills">
            {section.data.skills.map((item) => (
              <SkillRow key={item.skill} item={item} />
            ))}
          </ul>
          {section.status === "empty" && (
            <p className="yas-progress-boundary-note">
              Você ainda não possui uma avaliação objetiva registrada.
            </p>
          )}
        </Card>
      )}
    </section>
  );
}

function HistorySection({ history }: { history: ProgressHistoryEvent[] }) {
  return (
    <section className="yas-progress-section" aria-labelledby="progress-history-title">
      <SectionHeader
        title="Histórico"
        description="Uma linha do tempo formada apenas por fatos registrados."
      />
      <span id="progress-history-title" className="sr-only">
        Histórico
      </span>
      <Card>
        {history.length === 0 ? (
          <EmptyState
            title="Ainda sem histórico"
            description="Conclusões, práticas, chamadas e avaliações aparecerão aqui quando ocorrerem."
          />
        ) : (
          <ol className="yas-progress-timeline">
            {history.map((event) => (
              <li key={event.id}>
                <span className="yas-progress-timeline-marker" aria-hidden="true" />
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
    </section>
  );
}

export default async function ProgressPage() {
  const state = await loadProgressPage();

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
          description="Nenhuma projeção confiável pôde ser produzida agora. Tente novamente mais tarde."
        />
      </div>
    );
  }

  if (state.status === "empty") {
    return (
      <div className="yas-progress-page">
        <PageHeader title="Progresso" description="Entenda como sua jornada está avançando." />
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
        description="Uma leitura dos fatos da sua jornada, sem misturar curso, prática, presença e proficiência."
      />

      {state.status === "partial" && (
        <Alert
          tone="warning"
          title="Algumas informações estão temporariamente indisponíveis"
          description="As seções disponíveis continuam válidas; nenhum dado ausente foi transformado em zero."
        />
      )}

      <div className="yas-progress-overview">
        <Card className="yas-progress-cefr" variant="accent">
          <div className="yas-progress-card-stack">
            <Badge tone="info">Proficiência CEFR</Badge>
            <div>
              <span className="yas-progress-eyebrow">Nível atual</span>
              <h2>Nível CEFR ainda não disponível</h2>
              <p>{data.cefr.message}</p>
            </div>
            <small>Percentual do curso e pontuação objetiva não são nível de proficiência.</small>
          </div>
        </Card>

        <Card>
          <div className="yas-progress-card-stack">
            <span className="yas-progress-eyebrow">Consistência · últimos 7 dias</span>
            <strong className="yas-progress-highlight">
              {data.consistency.activeDaysLast7Days} dias ativos
            </strong>
            <dl className="yas-progress-stats yas-progress-stats--compact">
              <div>
                <dt>Aulas</dt>
                <dd>{data.consistency.lessonsCompletedLast7Days}</dd>
              </div>
              <div>
                <dt>Práticas</dt>
                <dd>{data.consistency.practicesCompletedLast7Days}</dd>
              </div>
              <div>
                <dt>Presenças</dt>
                <dd>{data.consistency.attendedLast7Days}</dd>
              </div>
            </dl>
            <small>Dias ativos derivam somente de fatos reais; não existe streak persistido.</small>
          </div>
        </Card>
      </div>

      <AssessmentSection section={data.assessment} />

      <div className="yas-progress-two-column">
        <CurriculumSection section={data.curriculum} />
        <PracticeSection section={data.practice} />
      </div>

      <div className="yas-progress-two-column yas-progress-two-column--balanced">
        <AttendanceSection section={data.attendance} />
        <section className="yas-progress-section" aria-labelledby="progress-goals-title">
          <SectionHeader
            title="Objetivos"
            description="Metas personalizadas ainda não fazem parte do contrato atual."
          />
          <span id="progress-goals-title" className="sr-only">
            Objetivos
          </span>
          <Card>
            <EmptyState
              title="Objetivos personalizados ainda não configurados"
              description="Nenhuma meta foi inventada e não há um formulário que aparente salvar algo sem uma fonte de verdade."
            />
          </Card>
        </section>
      </div>

      <HistorySection history={data.history} />
    </div>
  );
}
