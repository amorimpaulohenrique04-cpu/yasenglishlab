"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatedNumber } from "@/components/motion";
import {
  Alert,
  Badge,
  Breadcrumbs,
  Button,
  Card,
  Drawer,
  Dropdown,
  EmptyState,
  Icon,
  IconButton,
  PageHeader,
  Select,
  Tabs,
  type IconName,
  type Tint,
} from "@/components/ui";
import {
  EVENT_KINDS,
  KIND_LABELS,
  groupStudentActions,
  studentActionCta,
  studentActionDetail,
  studentActionHref,
  studentActionText,
  studentOverdueLabel,
  studentProfileUrl,
  studentRelativeDate,
  studentsUrl,
  type EventKind,
  type StudentActionLane,
  type StudentEventPage,
  type StudentFilters,
  type StudentAction,
  type StudentRow,
  type StudentsWorkspaceData,
} from "../domain/student-workspace";
import {
  StudentAdministrative,
  StudentEngagement,
  StudentPending,
  StudentEventList,
  StudentIdentity,
  StudentPagination,
  StudentProgress,
} from "./student-shared";
import styles from "./students.module.css";
import { TeacherMetric, TeacherMetricGrid } from "./teacher-metric";

const tabLabels = {
  all: "Todos os alunos",
  attention: "Precisam de atenção",
  inactive: "Sem atividade",
  pending: "Com pendências",
};
const TAB_ORDER = ["all", "attention", "pending", "inactive"] as const;
const PORTFOLIO_KEY = "yas:teacher-students:portfolio-open";
/** Matches the `48rem` breakpoint where the portfolio stops being a disclosure. */
const WIDE_QUERY = "(min-width: 48rem)";
const VISIBLE_ACTIONS = { desktop: 5, mobile: 3 };
const chartColors = [
  "var(--yas-color-purple-600)",
  "var(--yas-tint-blue-ink)",
  "var(--yas-tint-pink-ink)",
  "var(--yas-tint-green-ink)",
  "var(--yas-tint-yellow-ink)",
  "var(--yas-color-ink-soft)",
];
const laneCta: Record<StudentActionLane, string> = {
  overdue: "secondary",
  reviews: "outline",
  followUp: "ghost",
};
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
export function StudentsWorkspace({
  data,
  filters,
  eventsAction,
}: {
  data: StudentsWorkspaceData;
  filters: StudentFilters;
  eventsAction: (kind: string, page: number) => Promise<StudentEventPage>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchReset, setSearchReset] = useState(0);
  const back = studentsUrl({ ...filters, page: data.page });
  const href = (id: string) =>
    studentProfileUrl(id, { tab: "summary", kind: "all", page: 1, back });
  const go = (patch: Partial<StudentFilters>) =>
    startTransition(() => router.replace(studentsUrl(filters, patch), { scroll: false }));
  const metrics = data.metrics;
  const kpis: {
    label: string;
    value: number | null;
    detail: string;
    icon: IconName;
    tone: Tint;
    suffix?: string;
    href?: string;
    alert?: boolean;
  }[] = [
    {
      label: "Alunos acompanhados",
      value: metrics.students,
      detail: "com vínculo vigente",
      icon: "users",
      tone: "lilac",
    },
    {
      label: "Precisam de atenção",
      value: metrics.attention,
      detail: `de ${plural(metrics.students, "aluno", "alunos")} · inatividade ou novo teste`,
      icon: "clock",
      tone: "yellow",
      href: studentsUrl(filters, { tab: "attention" }),
      alert: metrics.attention > 0,
    },
    {
      label: "Revisões pendentes",
      value: metrics.practicePending + metrics.entryPending,
      detail: `${plural(metrics.practicePending, "prática", "práticas")} · ${plural(metrics.entryPending, "entrada", "entradas")}`,
      icon: "file",
      tone: "blue",
      href: studentsUrl(filters, { tab: "pending" }),
    },
    {
      label: "Progresso médio",
      value: metrics.averageProgress,
      suffix: "%",
      detail: `média de ${plural(metrics.activeEnrollments, "matrícula ativa", "matrículas ativas")} · curricular, não CEFR`,
      icon: "bars",
      tone: "green",
    },
  ];
  const activeFilters = [filters.course, filters.cohort, filters.status !== "all"].filter(
    Boolean,
  ).length;
  const tableContent = (
    <>
      <div className={styles.toolbar}>
        <SearchField
          key={searchReset}
          initial={filters.q}
          current={filters.q}
          onSearch={(q) => go({ q })}
        />
        <div className={styles.desktopFilters}>
          <StudentFilterControls
            data={data}
            filters={filters}
            onChange={go}
            compact
            includeOrder={filters.view === "cards"}
          />
        </div>
        <Button
          className={styles.mobileFilterButton}
          variant="outline"
          size="sm"
          leadingIcon={<Icon name="funnel" size={16} />}
          onClick={() => setFiltersOpen(true)}
        >
          {activeFilters ? `Filtros (${activeFilters})` : "Filtros"}
        </Button>
        <div className={styles.viewToggle} role="group" aria-label="Visualização dos alunos">
          <IconButton
            label="Visualizar em tabela"
            aria-pressed={filters.view === "table"}
            onClick={() => go({ view: "table" })}
          >
            <Icon name="menu" size={17} />
          </IconButton>
          <IconButton
            label="Visualizar em cartões"
            aria-pressed={filters.view === "cards"}
            onClick={() => go({ view: "cards" })}
          >
            <Icon name="grid" size={17} />
          </IconButton>
        </div>
      </div>
      {(filters.q ||
        filters.course ||
        filters.cohort ||
        filters.status !== "all" ||
        filters.tab !== "all") && (
        <div className={styles.appliedFilters}>
          <span>{data.total} alunos encontrados</span>
          <button
            type="button"
            className={styles.textLink}
            onClick={() => {
              setSearchReset((n) => n + 1);
              go({ q: "", course: "", cohort: "", status: "all", tab: "all" });
            }}
          >
            Limpar filtros
          </button>
        </div>
      )}
      {!data.items.length ? (
        <EmptyState
          title={metrics.students ? "Nenhum aluno encontrado" : "Nenhum aluno atribuído"}
          description={
            metrics.students
              ? "Ajuste os filtros para encontrar outros alunos."
              : "Alunos com vínculo pedagógico autorizado aparecerão aqui."
          }
        />
      ) : (
        <>
          <div className={styles.tableWrap} data-view={filters.view}>
            <table className={styles.table}>
              <caption className={styles.srOnly}>Alunos com vínculo pedagógico vigente</caption>
              <colgroup>
                <col className={styles.nameColumn} />
                <col className={styles.cohortColumn} />
                <col className={styles.progressColumn} />
                <col className={styles.engagementColumn} />
                <col className={styles.pendingColumn} />
                <col className={styles.activityColumn} />
                <col className={styles.actionColumn} />
              </colgroup>
              <thead>
                <tr>
                  <SortHeader order="name" filters={filters} onSort={go}>
                    Aluno
                  </SortHeader>
                  <th scope="col">Turma</th>
                  <SortHeader order="progress" filters={filters} onSort={go}>
                    Progresso
                  </SortHeader>
                  <th scope="col">Engajamento</th>
                  <th scope="col">Pendências</th>
                  <SortHeader
                    order="activity"
                    filters={filters}
                    onSort={go}
                    label="Última atividade"
                  >
                    Atividade
                  </SortHeader>
                  <th scope="col">
                    <span className={styles.srOnly}>Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((student) => (
                  <tr key={student.id}>
                    <td>
                      <StudentCell student={student} href={href(student.id)} />
                    </td>
                    <td>
                      <StudentAdministrative student={student} showCourse />
                    </td>
                    <td>
                      <StudentProgress enrollment={student.primary_enrollment} lessons />
                    </td>
                    <td>
                      <StudentEngagement student={student} />
                    </td>
                    <td>
                      <StudentPending student={student} />
                    </td>
                    <td>
                      <LastActivity student={student} />
                    </td>
                    <td>
                      <RowActions student={student} href={href} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.studentCards} data-view={filters.view}>
            {data.items.map((student) => (
              <article key={student.id} className={styles.studentCard}>
                <StudentCell student={student} href={href(student.id)} />
                <dl className={styles.cardFacts}>
                  <div>
                    <dt>Turma</dt>
                    <dd>
                      <StudentAdministrative student={student} showCourse />
                    </dd>
                  </div>
                  <div>
                    <dt>Engajamento</dt>
                    <dd>
                      <StudentEngagement student={student} />
                    </dd>
                  </div>
                  <div>
                    <dt>Pendências</dt>
                    <dd>
                      <StudentPending student={student} />
                    </dd>
                  </div>
                </dl>
                <StudentProgress enrollment={student.primary_enrollment} lessons />
                <LastActivity student={student} />
                <RowActions student={student} href={href} labelled />
              </article>
            ))}
          </div>
        </>
      )}
      <StudentPagination
        page={data.page}
        total={data.total}
        pageSize={data.pageSize}
        label="alunos"
        href={(page) => studentsUrl(filters, { page })}
      />
    </>
  );
  return (
    <div className={styles.page}>
      <Breadcrumbs
        homeHref="/teacher"
        homeLabel="Início do professor"
        items={[{ label: "Alunos" }]}
      />
      <PageHeader
        title="Alunos"
        description="Acompanhe o progresso, a participação e o engajamento dos seus alunos."
      />
      <TeacherMetricGrid label="Indicadores da carteira">
        {kpis.map((kpi, index) => (
          <TeacherMetric
            key={kpi.label}
            icon={kpi.icon}
            tone={kpi.tone}
            label={kpi.label}
            value={
              kpi.value === null ? (
                "—"
              ) : (
                <>
                  <AnimatedNumber value={kpi.value} />
                  {kpi.suffix}
                </>
              )
            }
            caption={kpi.detail}
            alert={kpi.alert ?? false}
            {...(kpi.href ? { href: kpi.href, arrow: true } : {})}
            enterStep={index}
          />
        ))}
      </TeacherMetricGrid>
      <div className={styles.overview}>
        <NextActions
          actions={data.actions}
          total={data.actionsTotal}
          href={href}
          allHref={studentsUrl(filters, { tab: "pending" })}
        />
        <PortfolioOverview data={data} href={href} eventsAction={eventsAction} />
      </div>
      <Card className={styles.directory} aria-busy={pending}>
        <Tabs
          variant="underline"
          ariaLabel="Filtrar alunos por acompanhamento"
          value={filters.tab}
          onValueChange={(tab) => go({ tab: tab as StudentFilters["tab"] })}
          items={TAB_ORDER.map((tab) => ({
            id: tab,
            label: tabLabels[tab],
            badge: data.counts[tab],
            content: tableContent,
          }))}
        />
      </Card>
      <Drawer
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        title="Filtrar alunos"
        icon="funnel"
        footer={<Button onClick={() => setFiltersOpen(false)}>Ver {data.total} alunos</Button>}
      >
        <StudentFilterControls data={data} filters={filters} onChange={go} includeOrder />
      </Drawer>
      <span className={styles.srOnly} role="status">
        {pending ? "Atualizando alunos…" : `${data.total} alunos encontrados`}
      </span>
    </div>
  );
}
function LastActivity({ student }: { student: StudentRow }) {
  return (
    <div className={styles.lastActivity}>
      {student.last_activity ? (
        <>
          <time dateTime={student.last_activity.occurred_at}>
            {studentRelativeDate(student.last_activity.occurred_at)}
          </time>
          <span>{student.last_activity.title}</span>
        </>
      ) : (
        <span>Sem atividade registrada</span>
      )}
    </div>
  );
}
function SearchField({
  initial,
  current,
  onSearch,
}: {
  initial: string;
  current: string;
  onSearch: (q: string) => void;
}) {
  const [q, setQ] = useState(initial);
  const latest = useRef(onSearch);
  useEffect(() => {
    latest.current = onSearch;
  });
  useEffect(() => {
    const next = q.trim();
    if (next === current) return;
    const timer = setTimeout(() => latest.current(next), 300);
    return () => clearTimeout(timer);
  }, [q, current]);
  return (
    <form
      className={styles.search}
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        onSearch(q.trim());
      }}
    >
      <Icon name="search" size={16} />
      <input
        aria-label="Buscar aluno por nome ou turma"
        placeholder="Buscar por nome ou turma…"
        value={q}
        maxLength={120}
        onChange={(event) => setQ(event.target.value)}
      />
      <button type="submit" className={styles.srOnly}>
        Buscar alunos
      </button>
    </form>
  );
}
function SortHeader({
  order,
  filters,
  onSort,
  label,
  children,
}: {
  order: StudentFilters["order"];
  filters: StudentFilters;
  onSort: (patch: Partial<StudentFilters>) => void;
  /** Full accessible name when the visible header is shortened. */
  label?: string;
  children: React.ReactNode;
}) {
  const active = filters.order === order;
  return (
    <th
      scope="col"
      data-active={active || undefined}
      aria-sort={active ? (order === "name" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        className={styles.sortButton}
        data-active={active}
        aria-label={label}
        title={label}
        onClick={() => onSort({ order })}
      >
        {children}
        <Icon name="down" size={13} />
      </button>
    </th>
  );
}
function RowActions({
  student,
  href,
  labelled = false,
}: {
  student: StudentRow;
  href: (id: string) => string;
  /** Cards view shows the visible "Abrir perfil" text next to the chevron. */
  labelled?: boolean;
}) {
  const profile = href(student.id);
  const base = profile.split("?")[0];
  const items = [
    ...(student.practice_pending > 0
      ? [
          {
            id: "reviews",
            label: "Revisões pendentes",
            href: `/teacher/revisoes?q=${encodeURIComponent(student.name)}`,
          },
        ]
      : []),
    { id: "sessions", label: "Sessões do aluno", href: `${base}?tab=activities&kind=session` },
  ];
  return (
    <div className={styles.rowActions}>
      <Link
        className={labelled ? styles.profileLink : styles.profileIcon}
        href={profile}
        aria-label={`Abrir perfil de ${student.name}`}
        title={labelled ? undefined : "Abrir perfil"}
      >
        {labelled && "Abrir perfil"}
        <Icon name="right" size={labelled ? 15 : 18} />
      </Link>
      <Dropdown
        label={`Mais ações para ${student.name}`}
        iconOnly
        icon="more"
        align="end"
        items={items}
      />
    </div>
  );
}
function StudentCell({ student, href }: { student: StudentRow; href: string }) {
  const extra = Math.max(
    0,
    student.enrollments.filter((e) => e.status !== "CANCELLED").length -
      (student.primary_enrollment ? 1 : 0),
  );
  return (
    <div className={styles.studentName}>
      <StudentIdentity name={student.name} size="sm" />
      <span>
        <Link className={styles.studentLink} href={href}>
          {student.name}
        </Link>
        {extra > 0 && <small>+{plural(extra, "curso", "cursos")}</small>}
      </span>
    </div>
  );
}
function NextActions({
  actions,
  total,
  href,
  allHref,
}: {
  actions: readonly StudentAction[];
  total: number;
  href: (id: string) => string;
  allHref: string;
}) {
  const [now] = useState(() => Date.now());
  const [expanded, setExpanded] = useState(false);
  const lanes = groupStudentActions(actions);
  const offsets = lanes.map((_, i) =>
    lanes.slice(0, i).reduce((sum, lane) => sum + lane.items.length, 0),
  );
  const hiddenDesktop = Math.max(0, actions.length - VISIBLE_ACTIONS.desktop);
  const hiddenMobile = Math.max(0, actions.length - VISIBLE_ACTIONS.mobile);
  const rank = (index: number) =>
    index < VISIBLE_ACTIONS.mobile ? "base" : index < VISIBLE_ACTIONS.desktop ? "desktop" : "more";
  return (
    <Card
      className={styles.actionsPanel}
      aria-labelledby="next-actions-title"
      data-expanded={expanded || undefined}
    >
      <div className={styles.actionsHeader}>
        <h2 id="next-actions-title">Próximas ações</h2>
        <span className={styles.muted}>{plural(total, "item", "itens")}</span>
      </div>
      {lanes.length ? (
        <div className={styles.lanes}>
          {lanes.map((lane, laneIndex) => (
            <section
              key={lane.lane}
              className={styles.lane}
              aria-labelledby={`next-actions-${lane.lane}`}
            >
              <h3
                id={`next-actions-${lane.lane}`}
                className={styles.laneTitle}
                data-lane={lane.lane}
              >
                {lane.label} <span>{lane.items.length}</span>
              </h3>
              <ul className={styles.actionsList}>
                {lane.items.map((action, i) => (
                  <li
                    key={`${action.studentId}-${action.kind}`}
                    data-rank={rank(offsets[laneIndex]! + i)}
                  >
                    <StudentIdentity name={action.name} size="sm" />
                    <div className={styles.actionText}>
                      <strong>{action.name}</strong>
                      <span>{studentActionDetail(action, now)}</span>
                    </div>
                    {action.overdue ? (
                      <Badge tone="error" className={styles.actionBadge}>
                        {studentOverdueLabel(action.waitingSince, now)}
                      </Badge>
                    ) : (
                      <span aria-hidden="true" />
                    )}
                    <Link
                      className={`yas-button yas-button--${laneCta[lane.lane]} yas-button--sm`}
                      href={studentActionHref(action, href)}
                      aria-label={`${studentActionCta(action)}: ${action.name}, ${studentActionText(action, now)}`}
                    >
                      {studentActionCta(action)}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <p className={styles.actionsEmpty}>Nada pendente agora</p>
      )}
      {(hiddenMobile > 0 || total > 0) && (
        <div className={styles.actionsFooter}>
          {hiddenMobile > 0 && (
            <button
              type="button"
              className={styles.textLink}
              data-only={hiddenDesktop > 0 ? undefined : "mobile"}
              aria-expanded={expanded}
              onClick={() => setExpanded((open) => !open)}
            >
              {expanded ? (
                "Ver menos"
              ) : (
                <>
                  Ver mais <span className={styles.onlyDesktop}>{hiddenDesktop}</span>
                  <span className={styles.onlyMobile}>{hiddenMobile}</span>
                </>
              )}
            </button>
          )}
          {total > 0 && (
            <Link className={styles.textLink} href={allHref} scroll={false}>
              Ver alunos com pendências{total > 8 ? ` (${total})` : ""}{" "}
              <Icon name="arrow" size={14} />
            </Link>
          )}
        </div>
      )}
    </Card>
  );
}
function PortfolioOverview({
  data,
  href,
  eventsAction,
}: {
  data: StudentsWorkspaceData;
  href: (id: string) => string;
  eventsAction: (kind: string, page: number) => Promise<StudentEventPage>;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    // Server render is open (desktop card); below 48rem it becomes a disclosure,
    // closed unless the teacher left it open.
    const query = window.matchMedia(WIDE_QUERY);
    const sync = () => {
      if (!ref.current) return;
      let stored = false;
      try {
        stored = window.localStorage.getItem(PORTFOLIO_KEY) === "1";
      } catch {
        /* storage unavailable: stay closed */
      }
      ref.current.open = query.matches || stored;
    };
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  const enrolled = data.distribution.filter((item) => item.id !== null);
  const waiting = data.distribution.find((item) => item.id === null)?.total ?? 0;
  return (
    <details
      ref={ref}
      open
      className={styles.portfolio}
      onToggle={(event) => {
        if (window.matchMedia(WIDE_QUERY).matches) return;
        try {
          window.localStorage.setItem(PORTFOLIO_KEY, event.currentTarget.open ? "1" : "0");
        } catch {
          /* ignore */
        }
      }}
    >
      <summary>
        <span className={styles.portfolioHeading}>
          <span className={styles.tileIcon} aria-hidden="true">
            <Icon name="layers" size={16} />
          </span>
          Visão da carteira
        </span>
        <Icon name="down" size={16} />
      </summary>
      <div className={styles.portfolioBody}>
        <h2 className={`${styles.portfolioTitle} ${styles.portfolioHeading}`}>
          <span className={styles.tileIcon} aria-hidden="true">
            <Icon name="layers" size={16} />
          </span>
          Visão da carteira
        </h2>
        <section aria-labelledby="portfolio-courses">
          <CourseDistribution data={enrolled} headingId="portfolio-courses" />
          {waiting > 0 && (
            <p className={styles.waitingStat}>
              <span className={styles.tileIcon} data-tint="yellow" aria-hidden="true">
                <Icon name="clock" size={16} />
              </span>
              <strong>{waiting}</strong>{" "}
              <span>{waiting === 1 ? "aluno aguardando" : "alunos aguardando"} matrícula</span>
            </p>
          )}
        </section>
        <section aria-labelledby="portfolio-events">
          <h3 id="portfolio-events">Atividades recentes</h3>
          <StudentEventList events={data.events} profileHref={href} grouped />
          <StudentEventsSheet action={eventsAction} profileHref={href} />
        </section>
      </div>
    </details>
  );
}
function StudentFilterControls({
  data,
  filters,
  onChange,
  compact = false,
  includeOrder = false,
}: {
  data: StudentsWorkspaceData;
  filters: StudentFilters;
  onChange: (patch: Partial<StudentFilters>) => void;
  /** Toolbar variant: visually hidden labels and short controls. */
  compact?: boolean;
  includeOrder?: boolean;
}) {
  return (
    <div className={styles.filterFields} data-compact={compact || undefined}>
      <Select
        label="Curso"
        value={filters.course}
        onChange={(event) => onChange({ course: event.target.value })}
        options={[
          { value: "", label: "Todos os cursos" },
          ...data.courses.map((c) => ({ value: c.id, label: c.name })),
        ]}
      />
      <Select
        label="Turma"
        value={filters.cohort}
        onChange={(event) => onChange({ cohort: event.target.value })}
        options={[
          { value: "", label: "Todas as turmas" },
          ...data.cohorts.map((c) => ({ value: c.id, label: c.name })),
        ]}
      />
      <Select
        label="Situação"
        value={filters.status}
        onChange={(event) => onChange({ status: event.target.value as StudentFilters["status"] })}
        options={[
          { value: "all", label: "Todas as situações" },
          { value: "ACTIVE", label: "Matrícula ativa" },
          { value: "COMPLETED", label: "Curso concluído" },
          { value: "CANCELLED", label: "Matrícula encerrada" },
          { value: "NONE", label: "Sem matrícula" },
        ]}
      />
      {includeOrder && (
        <Select
          label="Ordenar"
          value={filters.order}
          onChange={(event) => onChange({ order: event.target.value as StudentFilters["order"] })}
          options={[
            { value: "name", label: "Nome A–Z" },
            { value: "progress", label: "Maior progresso" },
            { value: "activity", label: "Atividade mais recente" },
          ]}
        />
      )}
    </div>
  );
}
function CourseDistribution({
  data,
  headingId,
}: {
  data: StudentsWorkspaceData["distribution"];
  headingId: string;
}) {
  const total = data.reduce((sum, item) => sum + item.total, 0);
  const percent = (value: number) => Math.round((value / Math.max(1, total)) * 100);
  return (
    <div className={styles.distribution}>
      <div className={styles.blockHead}>
        <h3 id={headingId}>Distribuição por curso</h3>
        {total > 0 && (
          <span className={styles.meta}>
            Base: {plural(total, "aluno matriculado", "alunos matriculados")}
          </span>
        )}
      </div>
      {total > 0 && (
        <div className={styles.stackedBar} aria-hidden="true">
          {data.map((item, i) => (
            <span
              key={item.id ?? "none"}
              style={{
                width: `${(item.total / total) * 100}%`,
                background:
                  i === 0
                    ? "linear-gradient(90deg, var(--yas-color-purple-600), var(--yas-color-purple-500))"
                    : chartColors[i % chartColors.length],
              }}
            />
          ))}
        </div>
      )}
      <ul aria-label="Alunos matriculados por curso" className={styles.legend}>
        {data.map((item, i) => (
          <li key={item.id ?? "none"}>
            <i style={{ background: chartColors[i % chartColors.length] }} aria-hidden="true" />
            <span>{item.name}</span>
            <strong>
              {item.total} · {percent(item.total)}%
            </strong>
          </li>
        ))}
        {!total && <li>Nenhum aluno matriculado.</li>}
      </ul>
    </div>
  );
}
function StudentEventsSheet({
  action,
  profileHref,
}: {
  action: (kind: string, page: number) => Promise<StudentEventPage>;
  profileHref: (id: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<EventKind>("all");
  const [data, setData] = useState<StudentEventPage | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const request = useRef(0);
  const load = (nextKind: EventKind, page: number) => {
    const token = ++request.current;
    setKind(nextKind);
    setError("");
    startTransition(async () => {
      try {
        const next = await action(nextKind, page);
        if (request.current === token) setData(next);
      } catch {
        if (request.current === token)
          setError("Não foi possível carregar as atividades. Tente novamente.");
      }
    });
  };
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className={styles.feedButton}
        trailingIcon={<Icon name="arrow" size={15} />}
        onClick={() => {
          setOpen(true);
          load("all", 1);
        }}
      >
        Ver todas as atividades
      </Button>
      <Drawer
        open={open}
        onOpenChange={setOpen}
        title="Atividades dos alunos"
        description="Registros de aprendizagem e sessões acessíveis na sua carteira."
        size="lg"
        icon="history"
      >
        <Select
          label="Tipo de atividade"
          value={kind}
          onChange={(event) => load(event.target.value as EventKind, 1)}
          options={EVENT_KINDS.map((value) => ({ value, label: KIND_LABELS[value] }))}
        />
        <div aria-busy={pending} className={styles.sheetContent}>
          {error ? (
            <Alert tone="error" title="Atividades indisponíveis" description={error} />
          ) : data ? (
            <StudentEventList events={data.items} profileHref={profileHref} />
          ) : (
            <p role="status">Carregando atividades…</p>
          )}
        </div>
        {data && (
          <StudentPagination
            page={data.page}
            pageSize={10}
            total={data.total}
            onPage={(page) => load(kind, page)}
            label="atividades"
          />
        )}
        {error && (
          <Button variant="outline" onClick={() => load(kind, data?.page ?? 1)}>
            Tentar novamente
          </Button>
        )}
      </Drawer>
    </>
  );
}
