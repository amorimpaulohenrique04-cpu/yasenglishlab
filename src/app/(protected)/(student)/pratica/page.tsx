import Link from "next/link";
import { redirect } from "next/navigation";
import { ViewTransition, type CSSProperties } from "react";

import {
  Alert,
  Badge,
  Card,
  EmptyState,
  ErrorState,
  Hero,
  Icon,
  IconBadge,
  PageHeader,
  type IconName,
} from "@/components/ui";
import {
  practiceContentPrompt,
  practiceHistoryDetail,
  practiceHistoryStatus,
  practiceSkillLabel,
  type PracticeActivityItem,
  type PracticeSkillCatalogItem,
} from "@/modules/practice";
import type { PracticeSkill } from "@/modules/domain";
import { loadLearningCourses } from "@/server/learning/canonical-slice";
import { SubscriptionSuspendedNotice } from "@/modules/billing/ui/suspension-notice";
import { loadCurrentSubscriptionAccess } from "@/server/billing/subscription-access";
import { loadPracticePage } from "@/server/practice/practice";
import { practiceSkillVisual } from "@/modules/practice/ui/skill-visual";

import {
  groupActivitiesByLesson,
  groupStateLabel,
  sectionsByModule,
  type LessonGroupState,
  type LessonPracticeGroupView,
  type ModulePracticeSection,
} from "./_practice/grouping";
import { ExpandableTiles } from "./_practice/expandable-tiles";
import { StartPracticeForm } from "./_practice/start-practice-form";

interface PracticePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const reveal = (index: number) => ({ "--yas-i": index }) as CSSProperties;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function availabilityLabel(item: PracticeSkillCatalogItem): string {
  if (item.availability === "DETERMINISTIC") return "Feedback objetivo";
  if (item.availability === "MANUAL_PENDING") return "Registro manual";
  return "Ainda sem conteúdo";
}

/**
 * Porta de entrada da biblioteca: resume tudo o que existe (atividades, aulas, habilidades)
 * e abre a visão completa organizada por aula.
 */
function PracticeLibraryTeaser({
  groups,
  activities,
}: {
  groups: LessonPracticeGroupView[];
  activities: PracticeActivityItem[];
}) {
  const lessons = groups.filter((group) => group.state !== "free").length;
  const minutes = activities.reduce((sum, activity) => sum + activity.estimatedMinutes, 0);
  const skills = [...new Set(activities.map((activity) => activity.skill))];
  return (
    <Link
      className="yas-practice-library yas-reveal"
      style={reveal(8)}
      href="/pratica?todas=1#praticas"
    >
      <span className="yas-practice-library-stack" aria-hidden="true">
        {skills.slice(0, 4).map((skill) => (
          <span key={skill} data-tint={practiceSkillVisual[skill].tint}>
            <Icon name={practiceSkillVisual[skill].icon} size={18} />
          </span>
        ))}
      </span>
      <span className="yas-practice-library-copy">
        <small>Biblioteca de práticas</small>
        <strong>Ver todas as práticas por aula</strong>
        <span>
          {activities.length} {activities.length === 1 ? "atividade" : "atividades"}
          {lessons > 0 && ` em ${lessons} ${lessons === 1 ? "aula" : "aulas"}`} · {minutes} min no
          total
        </span>
      </span>
      <span className="yas-practice-library-cta">
        Explorar
        <Icon name="arrow" size={18} />
      </span>
    </Link>
  );
}

/** Filtro por habilidade em chips; habilidades sem conteúdo ficam desativadas e explicadas. */
function SkillFilter({
  catalog,
  selected,
  showAll,
}: {
  catalog: PracticeSkillCatalogItem[];
  selected: PracticeSkill | null | undefined;
  showAll: boolean;
}) {
  const unsupported = catalog.filter((item) => item.availability === "UNSUPPORTED");
  return (
    <div className="yas-practice-filter">
      <h3 id="practice-skills-title">Escolha uma habilidade</h3>
      <nav className="yas-practice-chips" aria-labelledby="practice-skills-title">
        <Link
          className="yas-practice-chip"
          href={showAll ? "/pratica?todas=1#praticas" : "/pratica#praticas"}
          aria-current={selected ? undefined : "page"}
        >
          <Icon name="grid" size={16} />
          Todas
        </Link>
        {catalog.map((item) => {
          const visual = practiceSkillVisual[item.skill];
          return item.availability === "UNSUPPORTED" ? (
            <span
              key={item.skill}
              className="yas-practice-chip"
              data-disabled="true"
              aria-disabled="true"
              title={availabilityLabel(item)}
            >
              <Icon name={visual.icon} size={16} />
              {item.label}
            </span>
          ) : (
            <Link
              key={item.skill}
              className="yas-practice-chip"
              data-tint={visual.tint}
              href={`/pratica?skill=${item.skill}#praticas`}
              aria-current={selected === item.skill ? "page" : undefined}
              title={`${item.description} ${availabilityLabel(item)}.`}
            >
              <Icon name={visual.icon} size={16} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      {unsupported.length > 0 && (
        <p className="yas-practice-muted">
          {unsupported.map((item) => item.label).join(", ")}: ainda sem conteúdo publicado.
        </p>
      )}
    </div>
  );
}

function ModulePracticeBlock({
  section,
  index,
}: {
  section: ModulePracticeSection;
  index: number;
}) {
  const activities = section.lessons.reduce((sum, lesson) => sum + lesson.activities.length, 0);
  const minutes = section.lessons.reduce(
    (sum, lesson) =>
      sum + lesson.activities.reduce((total, item) => total + item.estimatedMinutes, 0),
    0,
  );
  const current = section.lessons.some((lesson) => lesson.state === "current");
  return (
    <section
      className="yas-practice-module yas-reveal"
      style={reveal(index + 1)}
      data-current={current || undefined}
      aria-labelledby={`practice-module-${section.key}`}
    >
      <header className="yas-practice-module-head">
        <span className="yas-practice-module-number" aria-hidden="true">
          {section.module ? section.module.position : <Icon name="spark" size={18} />}
        </span>
        <div>
          <small>
            {section.module ? `Módulo ${section.module.position}` : "Curso"}
            {current && <em>Você está aqui</em>}
          </small>
          <h3 id={`practice-module-${section.key}`}>
            {section.module ? section.module.title : "Práticas do curso"}
          </h3>
        </div>
        <span className="yas-practice-module-meta">
          {section.module &&
            `${section.lessons.length} ${section.lessons.length === 1 ? "aula" : "aulas"} · `}
          {activities} {activities === 1 ? "atividade" : "atividades"} · {minutes} min
        </span>
      </header>
      <div className="yas-practice-module-lessons">
        {section.lessons.map((lesson) => (
          <LessonPracticeGroup key={lesson.key} group={lesson} featured={false} open />
        ))}
      </div>
    </section>
  );
}

const FEATURED_HEADING: Record<LessonGroupState, { title: string; description: string }> = {
  done: {
    title: "Pratique o que você estudou",
    description: "Cada aula tem atividades curtas com o conteúdo que você viu nela.",
  },
  current: {
    title: "Pratique a aula atual",
    description: "Atividades curtas com o conteúdo da aula em que você está.",
  },
  open: {
    title: "Pratique uma aula liberada",
    description: "Atividades curtas de uma aula que você já abriu.",
  },
  free: {
    title: "Práticas do curso",
    description: "Consulte suas atividades e resultados nas aulas.",
  },
  locked: {
    title: "Pratique o conteúdo do curso",
    description: "As práticas de cada aula liberam quando você chega nela.",
  },
};

const groupIcon: Record<LessonGroupState, IconName> = {
  current: "play-c",
  done: "check-c",
  open: "book",
  locked: "lock",
  free: "spark",
};

function PracticeActivityAction({
  activity,
  label = "Praticar",
  soft = false,
  large = false,
}: {
  activity: PracticeActivityItem;
  label?: string;
  soft?: boolean;
  large?: boolean;
}) {
  if (activity.completedAttemptId) {
    return (
      <Link
        className={`yas-button yas-button--${soft ? "soft" : "primary"} yas-button--${large ? "lg" : "sm"}`}
        href={`/pratica/${activity.completedAttemptId}`}
      >
        Ver resultado →
      </Link>
    );
  }
  return (
    <StartPracticeForm
      activity={activity}
      label={activity.completedAttemptId === null ? "Ver resultado" : label}
      soft={soft}
      large={large}
    />
  );
}

function ActivityTile({
  activity,
  index,
  locked,
  extra = false,
}: {
  activity: PracticeActivityItem;
  index: number;
  locked: boolean;
  /** Featured lesson: tiles after the 3rd collapse on mobile. */
  extra?: boolean;
}) {
  const visual = practiceSkillVisual[activity.skill];
  return (
    <li
      className="yas-practice-activity-card yas-reveal"
      style={reveal(index + 2)}
      data-tint={visual.tint}
      data-extra={extra || undefined}
    >
      <div className="yas-practice-activity-top">
        <IconBadge icon={visual.icon} tone={visual.tint} shape="square" />
        <span className="yas-practice-activity-skill">{practiceSkillLabel(activity.skill)}</span>
        <span className="yas-practice-activity-time">
          <Icon name="clock" size={14} />
          {activity.estimatedMinutes} min
        </span>
      </div>
      <div className="yas-practice-activity-body">
        <h3>{activity.title}</h3>
        <p>{practiceContentPrompt(activity.content)}</p>
      </div>
      {locked ? (
        <p className="yas-practice-muted yas-practice-activity-locked">
          <Icon name="lock" size={14} />
          Libera quando você chegar a esta aula
        </p>
      ) : (
        <PracticeActivityAction activity={activity} soft />
      )}
    </li>
  );
}

/**
 * Aula em destaque (primeiro grupo) fica sempre aberta com CTA próprio; as demais
 * aulas são cartões recolhíveis com o mesmo grid de atividades.
 */
function LessonPracticeGroup({
  group,
  featured,
  open,
}: {
  group: LessonPracticeGroupView;
  featured: boolean;
  open: boolean;
}) {
  const minutes = group.activities.reduce((sum, activity) => sum + activity.estimatedMinutes, 0);
  const count = group.activities.length;
  const countLabel = `${count} ${count === 1 ? "atividade" : "atividades"} · ${minutes} min`;
  const lessonLink = group.lessonHref && (
    <Link className="yas-practice-lesson-link" href={group.lessonHref}>
      {group.state === "done" ? "Rever a aula" : "Ir para a aula"}
      <Icon name="arrow" size={16} />
    </Link>
  );
  const renderTiles = (collapseAfter: number) =>
    group.activities.map((activity, index) => (
      <ActivityTile
        key={activity.id}
        activity={activity}
        index={index}
        locked={!group.reachableIds.has(activity.id)}
        extra={index >= collapseAfter}
      />
    ));
  const tiles = <ul className="yas-practice-tiles">{renderTiles(Number.POSITIVE_INFINITY)}</ul>;

  if (featured) {
    const first = group.activities[0];
    return (
      <article
        className="yas-practice-lesson yas-practice-lesson--featured"
        data-state={group.state}
        aria-labelledby={`practice-lesson-${group.key}`}
      >
        <header className="yas-practice-lesson-hero">
          <span className="yas-practice-lesson-kicker">
            <Icon name={groupIcon[group.state]} size={15} />
            {groupStateLabel[group.state]} · {group.context}
          </span>
          <h3 id={`practice-lesson-${group.key}`}>{group.title}</h3>
          <p>
            {countLabel}
            {group.state === "free" ? "." : " com o conteúdo desta aula."}
          </p>
          <div className="yas-practice-lesson-actions">
            {/* A ação primária da página é a do hero; aqui ela é secundária. */}
            {first && <PracticeActivityAction activity={first} label="Praticar esta aula" soft />}
            {lessonLink}
          </div>
        </header>
        <ExpandableTiles extraCount={Math.max(0, count - 3)}>{renderTiles(3)}</ExpandableTiles>
      </article>
    );
  }

  return (
    <details className="yas-practice-lesson" data-state={group.state} open={open}>
      <summary>
        <span className="yas-practice-lesson-icon" aria-hidden="true">
          <Icon name={groupIcon[group.state]} size={18} />
        </span>
        <span className="yas-practice-lesson-copy">
          {/* Dentro do bloco do módulo, basta a aula ("Aula 02"). */}
          <small>
            {groupStateLabel[group.state]} ·{" "}
            {group.module ? group.context.split(" · ").at(-1) : group.context}
          </small>
          <strong>{group.title}</strong>
        </span>
        <span className="yas-practice-lesson-count">{countLabel}</span>
        <Icon name="right" size={18} className="yas-practice-lesson-chevron" />
      </summary>
      <div className="yas-practice-lesson-body">
        {tiles}
        {lessonLink && <div className="yas-practice-lesson-footer">{lessonLink}</div>}
      </div>
    </details>
  );
}

function formatHistoryDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(
    new Date(value),
  );
}

export default async function PracticePage({ searchParams }: PracticePageProps) {
  const params = await searchParams;
  // Links antigos (`?attempt=`) abrem a prática na sua tela própria.
  const legacyAttempt = firstValue(params.attempt);
  if (legacyAttempt) {
    const completed = firstValue(params.completed) === "1" ? "?completed=1" : "";
    redirect(`/pratica/${encodeURIComponent(legacyAttempt)}${completed}`);
  }
  const access = await loadCurrentSubscriptionAccess();
  // ?suspended=1 comes from an action that was refused mid-flow; the access state is the source of truth.
  if (access.kind === "suspended") {
    return (
      <div className="yas-practice-page">
        <PageHeader title="Prática" description="Treine um pouco todos os dias." />
        <SubscriptionSuspendedNotice access={access} context="practice" />
      </div>
    );
  }
  const state = await loadPracticePage({ skill: firstValue(params.skill) });

  if (state.status === "unauthorized") {
    return (
      <div className="yas-practice-page">
        <PageHeader title="Prática" description="Treine um pouco todos os dias." />
        <ErrorState
          title="Acesso não autorizado"
          description="Sua conta não possui acesso às tentativas de aluno."
        />
      </div>
    );
  }

  if (state.status === "empty") {
    return (
      <div className="yas-practice-page">
        <PageHeader title="Prática" description="Treine um pouco todos os dias." tagline />
        <EmptyState
          title="Nenhuma prática disponível"
          description="As atividades acompanham o curso da sua matrícula e aparecem aqui quando estiverem publicadas. Sem matrícula ativa, conclua sua entrada no Yas para começar."
        />
      </div>
    );
  }

  const {
    activities,
    catalog,
    completedThisWeek,
    firstTryCorrectThisWeek,
    history,
    objectiveQuestionsThisWeek,
    estimatedMinutesThisWeek,
    reachedActivityIds,
    recommendation,
    selectedSkill,
  } = state.data;
  const accuracyPercent =
    objectiveQuestionsThisWeek > 0
      ? Math.round((firstTryCorrectThisWeek / objectiveQuestionsThisWeek) * 100)
      : null;
  const requestedActivity = activities.find((item) => item.id === firstValue(params.activity));
  // Mesmo sem a trilha carregada, a biblioteca continua mostrando as atividades do curso.
  const learning = await loadLearningCourses().catch(() => null);
  // Filtrar por habilidade já é explorar a biblioteca: abre a visão completa.
  const showAll = firstValue(params.todas) === "1" || Boolean(selectedSkill);
  const groups = groupActivitiesByLesson(
    activities,
    learning?.status === "success" ? learning.data : [],
    new Set(reachedActivityIds),
  );
  // O destaque é sempre uma aula que o aluno pode praticar; o título acompanha o estado dela.
  const featured = groups.find((group) => group.state !== "locked") ?? null;
  const featuredHeading = featured ? FEATURED_HEADING[featured.state] : FEATURED_HEADING.locked;

  return (
    <ViewTransition
      enter={{ "nav-back": "yas-page-back", default: "none" }}
      exit={{ default: "none" }}
      default="none"
    >
      <div className="yas-practice-page">
        <PageHeader
          title="Prática"
          description="Treine um pouco todos os dias e ganhe mais confiança no inglês."
          tagline
        />

        {firstValue(params.suspended) === "1" && (
          <Alert
            tone="info"
            title="Sua atividade não foi registrada"
            description="O acesso estava em pausa naquele momento. Se o pagamento já foi confirmado, você pode praticar de novo agora."
          />
        )}

        {firstValue(params.bloqueada) === "1" && (
          <Alert
            tone="info"
            title="Esta prática ainda não está liberada"
            description="Ela abre quando você chegar à aula dela. Continue pela aula atual."
          />
        )}

        {requestedActivity && (
          <Card className="yas-practice-requested">
            <IconBadge
              icon={practiceSkillVisual[requestedActivity.skill].icon}
              tone={practiceSkillVisual[requestedActivity.skill].tint}
              shape="square"
            />
            <div>
              <h2 className="yas-card-title">{requestedActivity.title}</h2>
              <p className="yas-practice-muted">
                {practiceContentPrompt(requestedActivity.content)}
              </p>
            </div>
            <PracticeActivityAction activity={requestedActivity} label="Começar tarefa" />
          </Card>
        )}

        <div className="yas-practice-top-grid">
          {recommendation ? (
            <Hero
              className="yas-reveal"
              style={reveal(1)}
              kicker="Prática de hoje"
              kickerIcon="target"
              title={
                recommendation.reason === "RESUME_ATTEMPT"
                  ? "Continue de onde parou"
                  : `${recommendation.activity.estimatedMinutes} minutos para praticar agora`
              }
              photo="/brand/hero-practice.webp"
              actions={
                recommendation.reason === "RESUME_ATTEMPT" && recommendation.attemptId ? (
                  <Link
                    className="yas-button yas-button--primary yas-button--lg"
                    href={`/pratica/${recommendation.attemptId}`}
                  >
                    Continuar →
                  </Link>
                ) : (
                  <StartPracticeForm
                    activity={recommendation.activity}
                    label="Começar prática"
                    large
                  />
                )
              }
            >
              <div className="yas-practice-hero-chips">
                <span className="yas-hero-chip">
                  <Icon name={practiceSkillVisual[recommendation.activity.skill].icon} size={15} />
                  {practiceSkillLabel(recommendation.activity.skill)}
                </span>
                <span className="yas-hero-chip">
                  <Icon name="book" size={15} />
                  {recommendation.activity.title}
                </span>
              </div>
              <p className="yas-hero-text">{recommendation.explanation}</p>
            </Hero>
          ) : (
            <Hero
              className="yas-reveal"
              style={reveal(1)}
              kicker="Prática de hoje"
              kickerIcon="target"
              title="Sem recomendação disponível"
              photo="/brand/hero-practice.webp"
            >
              <p className="yas-hero-text">
                {activities.length > 0
                  ? "Todas as práticas disponíveis já foram concluídas. Consulte seus resultados abaixo."
                  : "Nenhuma prática está disponível para esta habilidade."}
              </p>
            </Hero>
          )}

          <Card
            className="yas-practice-week yas-reveal"
            style={reveal(2)}
            aria-labelledby="practice-week-title"
          >
            <div className="yas-card-header">
              <h2 className="yas-card-title" id="practice-week-title">
                Resumo da semana
              </h2>
              <span className="yas-practice-week-period">7 dias</span>
            </div>
            <div className="yas-practice-week-body">
              <div
                className="yas-practice-week-ring"
                style={{ "--yas-ring-value": accuracyPercent ?? 0 } as CSSProperties}
                role="img"
                aria-label={
                  accuracyPercent === null
                    ? "Sem perguntas objetivas nos últimos 7 dias"
                    : `${firstTryCorrectThisWeek} de ${objectiveQuestionsThisWeek} acertos na primeira tentativa`
                }
              >
                <span aria-hidden="true">
                  {accuracyPercent === null ? (
                    <Icon name="target" size={22} />
                  ) : (
                    <strong>{accuracyPercent}%</strong>
                  )}
                  <small>acertos</small>
                </span>
              </div>
              <ul className="yas-practice-week-kpis">
                <li>
                  <IconBadge icon="clock" />
                  <span>
                    <strong>
                      {estimatedMinutesThisWeek}
                      <small>min</small>
                    </strong>
                    <span>de prática</span>
                  </span>
                </li>
                <li>
                  <IconBadge icon="check-c" tone="blue" />
                  <span>
                    <strong>{completedThisWeek}</strong>
                    <span>{completedThisWeek === 1 ? "atividade" : "atividades"}</span>
                  </span>
                </li>
              </ul>
            </div>
            <Link className="yas-practice-week-review" href="/progresso">
              <Icon name="bars" size={18} />
              <span>Seu progresso</span>
              <span className="yas-practice-week-review-more">
                Ver progresso <Icon name="arrow" size={16} />
              </span>
            </Link>
          </Card>
        </div>

        <div className="yas-practice-content-grid">
          <section
            id="praticas"
            className="yas-practice-section yas-practice-main yas-reveal"
            style={reveal(4)}
            aria-labelledby="practice-activities-title"
          >
            <div className="yas-practice-main-heading">
              <span className="yas-practice-eyebrow">
                {showAll ? "Biblioteca de práticas" : "Por aula"}
              </span>
              <div className="yas-practice-main-title">
                <h2 id="practice-activities-title">
                  {selectedSkill
                    ? `${practiceSkillLabel(selectedSkill)} nas suas aulas`
                    : showAll
                      ? "Todas as práticas"
                      : featuredHeading.title}
                </h2>
                {showAll && (
                  <Link className="yas-practice-back" href="/pratica#praticas">
                    <Icon name="left" size={16} />
                    Voltar ao destaque
                  </Link>
                )}
              </div>
              <p>
                {showAll
                  ? `${activities.length} ${activities.length === 1 ? "atividade organizada" : "atividades organizadas"} pela aula em que o conteúdo aparece.`
                  : featuredHeading.description}
              </p>
            </div>

            <SkillFilter catalog={catalog} selected={selectedSkill} showAll={showAll} />

            {activities.length === 0 ? (
              <Card>
                <EmptyState
                  title="Sem conteúdo suportado"
                  description="Esta habilidade ficará disponível quando houver conteúdo contratado."
                />
              </Card>
            ) : (
              /* Destaque ⇄ Biblioteca: o conteúdo troca com crossfade (mesma rota, chave diferente). */
              <ViewTransition
                key={showAll ? "library" : "featured"}
                name="practice-main-content"
                share="auto"
                enter="auto"
                default="none"
              >
                {showAll ? (
                  <div className="yas-practice-modules">
                    {sectionsByModule(groups).map((section, index) => (
                      <ModulePracticeBlock key={section.key} section={section} index={index} />
                    ))}
                  </div>
                ) : (
                  <div className="yas-practice-lessons">
                    {featured && <LessonPracticeGroup group={featured} featured open />}
                    <PracticeLibraryTeaser groups={groups} activities={activities} />
                    <a className="yas-practice-history-jump" href="#historico">
                      Ver histórico recente
                      <Icon name="down" size={16} />
                    </a>
                  </div>
                )}
              </ViewTransition>
            )}
          </section>

          <aside
            id="historico"
            className="yas-reveal"
            style={reveal(5)}
            aria-labelledby="practice-history-title"
          >
            <Card className="yas-practice-history-card">
              <div className="yas-card-header">
                <h2 className="yas-card-title" id="practice-history-title">
                  Histórico recente
                </h2>
              </div>
              {history.length === 0 ? (
                <p className="yas-practice-muted">Sua primeira prática aparecerá aqui.</p>
              ) : (
                <ol className="yas-list yas-practice-history-list">
                  {history.map((item) => (
                    <li key={item.id}>
                      <IconBadge
                        icon={practiceSkillVisual[item.skill].icon}
                        tone={practiceSkillVisual[item.skill].tint}
                        shape="square"
                      />
                      {item.status === "ABANDONED" ? (
                        <span className="yas-list-text">
                          <strong>{item.activityTitle}</strong>
                          <small>{formatHistoryDate(item.submittedAt ?? item.startedAt)}</small>
                        </span>
                      ) : (
                        /* Retomar uma prática em andamento ou rever o resultado. */
                        <Link
                          className="yas-list-text yas-practice-history-link"
                          href={`/pratica/${item.id}`}
                        >
                          <strong>{item.activityTitle}</strong>
                          <small>
                            {item.attemptKind === "REVIEW" && "Revisão · "}
                            {formatHistoryDate(item.submittedAt ?? item.startedAt)} ·{" "}
                            {item.status === "IN_PROGRESS" ? "Continuar" : "Ver resultado"}
                            {practiceHistoryDetail(item) && ` · ${practiceHistoryDetail(item)}`}
                          </small>
                        </Link>
                      )}
                      <Badge
                        tone={
                          item.evaluationStatus === "CORRECT" ||
                          item.evaluationStatus === "MANUAL_REVIEWED"
                            ? "success"
                            : item.evaluationStatus === "PENDING_MANUAL"
                              ? "warning"
                              : "muted"
                        }
                      >
                        {practiceHistoryStatus(item)}
                      </Badge>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          </aside>
        </div>
      </div>
    </ViewTransition>
  );
}
