"use client";
import Link from "next/link";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatedNumber } from "@/components/motion";
import {
  Alert,
  Breadcrumbs,
  Button,
  Card,
  Drawer,
  Dropdown,
  EmptyState,
  Icon,
  IconBadge,
  IconButton,
  PageHeader,
  Select,
  Tabs,
  type IconName,
} from "@/components/ui";
import {
  EVENT_KINDS,
  KIND_LABELS,
  STUDENT_TABS,
  studentProfileUrl,
  studentRelativeDate,
  studentsUrl,
  type EventKind,
  type StudentEventPage,
  type StudentFilters,
  type StudentRow,
  type StudentsWorkspaceData,
} from "../domain/student-workspace";
import {
  EnrollmentContext,
  StudentAttention,
  StudentEventList,
  StudentIdentity,
  StudentPagination,
  StudentProgress,
} from "./student-shared";
import styles from "./students.module.css";

const tabLabels = {
  all: "Todos os alunos",
  attention: "Precisam de atenção",
  inactive: "Sem atividade",
};
const chartColors = [
  "var(--yas-color-purple-600)",
  "var(--yas-tint-blue-ink)",
  "var(--yas-tint-pink-ink)",
  "var(--yas-tint-green-ink)",
  "var(--yas-tint-yellow-ink)",
  "var(--yas-color-muted)",
];
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
    tone: "lilac" | "yellow";
    suffix?: string;
  }[] = [
    {
      label: "Alunos acompanhados",
      value: metrics.students,
      detail: "Com vínculo pedagógico vigente",
      icon: "users",
      tone: "lilac",
    },
    {
      label: "Precisam de atenção",
      value: metrics.attention,
      detail: `${
        metrics.students ? Math.round((metrics.attention / metrics.students) * 100) : 0
      }% do total`,
      icon: "clock",
      tone: "yellow",
    },
    {
      label: "Revisões pendentes",
      value: metrics.practicePending + metrics.entryPending,
      detail: `${metrics.practicePending} práticas · ${metrics.entryPending} de entrada`,
      icon: "file",
      tone: "lilac",
    },
    {
      label: "Progresso médio",
      value: metrics.averageProgress,
      suffix: "%",
      detail: `${metrics.activeEnrollments} matrículas ativas com trilha`,
      icon: "bars",
      tone: "lilac",
    },
  ];
  const filterControls = <StudentFilterControls data={data} filters={filters} onChange={go} />;
  const tableContent = (
    <>
      <div className={styles.toolbar}>
        <SearchField
          key={searchReset}
          initial={filters.q}
          current={filters.q}
          onSearch={(q) => go({ q })}
        />
        <div className={styles.desktopFilters}>{filterControls}</div>
        <Button
          className={styles.mobileFilterButton}
          variant="outline"
          leadingIcon={<Icon name="funnel" size={16} />}
          onClick={() => setFiltersOpen(true)}
        >
          Filtros
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
                <col className={styles.courseColumn} />
                <col className={styles.progressColumn} />
                <col className={styles.activityColumn} />
                <col className={styles.statusColumn} />
                <col className={styles.actionColumn} />
              </colgroup>
              <thead>
                <tr>
                  <SortHeader order="name" filters={filters} onSort={go}>
                    Aluno
                  </SortHeader>
                  <th scope="col">Turma / curso</th>
                  <SortHeader order="progress" filters={filters} onSort={go}>
                    Progresso curricular
                  </SortHeader>
                  <SortHeader order="activity" filters={filters} onSort={go}>
                    Última atividade
                  </SortHeader>
                  <th scope="col">Situação</th>
                  <th scope="col">Ações</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((student) => (
                  <tr key={student.id}>
                    <td>
                      <Link className={styles.studentName} href={href(student.id)}>
                        <StudentIdentity name={student.name} />
                        <span>
                          <strong>{student.name}</strong>
                        </span>
                      </Link>
                    </td>
                    <td>
                      <EnrollmentContext
                        enrollment={student.primary_enrollment}
                        extra={Math.max(
                          0,
                          student.enrollments.filter((e) => e.status !== "CANCELLED").length -
                            (student.primary_enrollment ? 1 : 0),
                        )}
                      />
                    </td>
                    <td>
                      <StudentProgress enrollment={student.primary_enrollment} />
                    </td>
                    <td>
                      <LastActivity student={student} />
                    </td>
                    <td>
                      <StudentAttention student={student} />
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
                <Link className={styles.studentName} href={href(student.id)}>
                  <StudentIdentity name={student.name} />
                  <span>
                    <strong>{student.name}</strong>
                  </span>
                </Link>
                <EnrollmentContext
                  enrollment={student.primary_enrollment}
                  extra={Math.max(
                    0,
                    student.enrollments.filter((e) => e.status !== "CANCELLED").length -
                      (student.primary_enrollment ? 1 : 0),
                  )}
                />
                <StudentProgress enrollment={student.primary_enrollment} />
                <LastActivity student={student} />
                <StudentAttention student={student} />
                <RowActions student={student} href={href} />
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
      <div className={styles.kpis}>
        {kpis.map((kpi) => (
          <Card key={kpi.label} className={styles.kpi}>
            <IconBadge icon={kpi.icon} tone={kpi.tone} shape="square" />
            <div>
              <span>{kpi.label}</span>
              <strong>
                {kpi.value === null ? (
                  "—"
                ) : (
                  <>
                    <AnimatedNumber value={kpi.value} />
                    {kpi.suffix}
                  </>
                )}
              </strong>
              <small>{kpi.detail}</small>
            </div>
          </Card>
        ))}
      </div>
      <p className={styles.metricHelp}>
        Indicadores de toda a sua carteira autorizada. Progresso curricular não representa
        proficiência CEFR. “Sem atividade” considera alunos com matrícula ativa sem registros de
        aprendizagem há 7 dias ou mais.
      </p>
      <div className={styles.layout}>
        <Card className={styles.directory} aria-busy={pending}>
          <Tabs
            variant="underline"
            ariaLabel="Filtrar alunos por acompanhamento"
            value={filters.tab}
            onValueChange={(tab) => go({ tab: tab as StudentFilters["tab"] })}
            items={STUDENT_TABS.map((tab) => ({
              id: tab,
              label: tabLabels[tab],
              badge: data.counts[tab],
              content: tableContent,
            }))}
          />
        </Card>
        <aside className={styles.sidebar} aria-label="Resumo da carteira">
          <Card className={styles.reviewLinks}>
            <Link
              className="yas-button yas-button--outline yas-button--sm"
              href="/teacher/revisoes"
            >
              Ver revisões de práticas <Icon name="arrow" size={15} />
            </Link>
            <Link className={styles.textLink} href="/teacher/revisoes/placement">
              Revisões de entrada <Icon name="arrow" size={14} />
            </Link>
          </Card>
          <Card className={styles.sideCard}>
            <h2>Distribuição por curso</h2>
            <CourseDistribution data={data.distribution} />
          </Card>
          <Card className={styles.sideCard}>
            <h2>Atividades recentes</h2>
            <StudentEventList events={data.events} profileHref={href} />
            <StudentEventsSheet action={eventsAction} profileHref={href} />
          </Card>
          <Link
            className={styles.coaching}
            href={studentsUrl(filters, { tab: data.counts.attention ? "attention" : "all" })}
          >
            <IconBadge icon="bars" shape="square" />
            <h2>Acompanhamento individual</h2>
            <p>
              Abra o perfil de cada aluno para ver detalhes do progresso, revisões e histórico
              pedagógico.
            </p>
            <span className={styles.coachingCta}>
              {data.counts.attention ? "Ver quem precisa de atenção" : "Ver todos os alunos"}
              <Icon name="arrow" size={15} />
            </span>
          </Link>
        </aside>
      </div>
      <Drawer
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        title="Filtrar alunos"
        icon="funnel"
        footer={<Button onClick={() => setFiltersOpen(false)}>Ver {data.total} alunos</Button>}
      >
        {filterControls}
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
      <Icon name="search" size={18} />
      <input
        aria-label="Buscar aluno por nome ou turma"
        placeholder="Buscar por nome ou turma…"
        value={q}
        maxLength={120}
        onChange={(event) => setQ(event.target.value)}
      />
      <button type="submit" aria-label="Buscar alunos">
        <Icon name="arrow" size={16} />
      </button>
    </form>
  );
}
function SortHeader({
  order,
  filters,
  onSort,
  children,
}: {
  order: StudentFilters["order"];
  filters: StudentFilters;
  onSort: (patch: Partial<StudentFilters>) => void;
  children: React.ReactNode;
}) {
  const active = filters.order === order;
  return (
    <th scope="col" aria-sort={active ? (order === "name" ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        className={styles.sortButton}
        data-active={active}
        onClick={() => onSort({ order })}
      >
        {children}
        <Icon name="down" size={13} />
      </button>
    </th>
  );
}
function RowActions({ student, href }: { student: StudentRow; href: (id: string) => string }) {
  const profile = href(student.id);
  const base = profile.split("?")[0];
  return (
    <div className={styles.rowActions}>
      <Link className={styles.profileLink} href={profile}>
        Ver perfil <Icon name="arrow" size={15} />
      </Link>
      <Dropdown
        label={`Mais ações para ${student.name}`}
        iconOnly
        icon="more"
        align="end"
        items={[
          { id: "profile", label: "Ver perfil", href: profile },
          { id: "reviews", label: "Revisões pendentes", href: "/teacher/revisoes" },
          {
            id: "sessions",
            label: "Sessões do aluno",
            href: `${base}?tab=activities&kind=session`,
          },
        ]}
      />
    </div>
  );
}
function StudentFilterControls({
  data,
  filters,
  onChange,
}: {
  data: StudentsWorkspaceData;
  filters: StudentFilters;
  onChange: (patch: Partial<StudentFilters>) => void;
}) {
  return (
    <div className={styles.filterFields}>
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
    </div>
  );
}
function CourseDistribution({ data }: { data: StudentsWorkspaceData["distribution"] }) {
  const id = useId();
  const total = data.reduce((sum, item) => sum + item.total, 0);
  return (
    <div className={styles.distribution}>
      <div className={styles.donut} aria-hidden="true">
        <svg viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="47" fill="none" stroke="var(--yas-track)" strokeWidth="12" />
          {data.map((item, i) => {
            const fraction = (item.total / Math.max(1, total)) * 100;
            const previous =
              (data.slice(0, i).reduce((sum, segment) => sum + segment.total, 0) /
                Math.max(1, total)) *
              100;
            return (
              <circle
                key={item.id ?? "none"}
                cx="60"
                cy="60"
                r="47"
                fill="none"
                stroke={chartColors[i % chartColors.length]}
                strokeWidth="12"
                pathLength="100"
                strokeDasharray={`${fraction} ${100 - fraction}`}
                strokeDashoffset={-previous}
                transform="rotate(-90 60 60)"
              />
            );
          })}
        </svg>
        <div>
          <strong>{total}</strong>
          <span>alunos</span>
        </div>
      </div>
      <ul aria-label="Alunos por curso" id={id} className={styles.legend}>
        {data.map((item, i) => (
          <li key={item.id ?? "none"}>
            <i style={{ background: chartColors[i % chartColors.length] }} aria-hidden="true" />
            <span>{item.name}</span>
            <strong>{item.total}</strong>
            <small>{Math.round((item.total / Math.max(1, total)) * 100)}%</small>
          </li>
        ))}
        {!total && <li>Sem alunos para distribuir.</li>}
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
