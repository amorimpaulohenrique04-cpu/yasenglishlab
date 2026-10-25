"use client";

import Link from "next/link";
import { useState, type CSSProperties } from "react";
import {
  Avatar,
  Badge,
  Breadcrumbs,
  Button,
  Card,
  Drawer,
  EmptyState,
  Icon,
  IconBadge,
  Input,
  PageHeader,
  Select,
  Tooltip,
} from "@/components/ui";
import { initials } from "../domain/session-calendar";
import {
  cohortAgendaUrl,
  cohortMetrics,
  cohortSchedule,
  cohortStudentsUrl,
  entranceStep,
  nextCohortSession,
  visibleCohorts,
  type CohortOrder,
  type TeacherCohort,
} from "../domain/cohort-workspace";
import styles from "./cohorts.module.css";
import { TeacherMetric, TeacherMetricGrid } from "./teacher-metric";

const dateLabel = (value: string, timezone: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: timezone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

const stagger = (step: number) => ({ "--stagger": step }) as CSSProperties;

function CohortStudents({ cohort, compact = false }: { cohort: TeacherCohort; compact?: boolean }) {
  const students = compact ? cohort.students.slice(0, 5) : cohort.students;
  if (!cohort.occupancy)
    return (
      <div className={styles.noStudents}>
        <Icon name="users" size={44} />
        <strong>Ainda sem alunos</strong>
        <p>
          Os alunos aparecerão aqui assim que forem matriculados nesta turma pelo administrador.
        </p>
      </div>
    );
  return (
    <>
      <ul className={styles.students}>
        {students.map((student) => (
          <li key={student.id}>
            <Link href={`/teacher/alunos/${student.id}`}>
              <span aria-hidden="true">
                <Avatar
                  label={student.name ?? "Aluno"}
                  fallback={initials(student.name ?? "Aluno")}
                  size="sm"
                  tone="neutral"
                />
              </span>
              <span>{student.name ?? "Aluno"}</span>
              {!compact && <Icon name="right" size={16} />}
            </Link>
          </li>
        ))}
      </ul>
      {cohort.occupancy > students.length && (
        <p className={styles.previewNote}>
          Exibindo {students.length} de {cohort.occupancy} alunos.{" "}
          <Link href={cohortStudentsUrl(cohort.id)}>Ver lista completa</Link>
        </p>
      )}
    </>
  );
}

export function CohortsWorkspace({ cohorts }: { cohorts: TeacherCohort[] }) {
  const [query, setQuery] = useState("");
  const [order, setOrder] = useState<CohortOrder>("meeting");
  const [selected, setSelected] = useState<TeacherCohort | null>(null);
  // Entrance motion runs only on first paint; filtering/sorting must not replay it.
  const [entrance, setEntrance] = useState(true);
  const metrics = cohortMetrics(cohorts);
  const visible = visibleCohorts(cohorts, query, order);
  const kpis = [
    {
      label: "Total de turmas",
      value: metrics.cohorts,
      caption: "Turmas vinculadas a você",
      icon: "users",
      tone: "lilac",
    },
    {
      label: "Matrículas ativas",
      value: metrics.memberships,
      caption: "Alunos nas suas turmas",
      icon: "grad",
      tone: "blue",
    },
    {
      label: "Turmas com encontro",
      value: metrics.withMeeting,
      caption: "Com sessão agendada",
      icon: "cal",
      tone: "green",
    },
    {
      label: "Vagas disponíveis",
      value: metrics.vacancies ?? "—",
      caption: metrics.configured
        ? `Em ${metrics.configured} ${metrics.configured === 1 ? "turma" : "turmas"} com capacidade`
        : "Capacidade não definida",
      icon: "user",
      tone: "yellow",
    },
  ] as const;
  return (
    <div className={styles.page} data-entrance={entrance ? "" : undefined}>
      <Breadcrumbs
        homeHref="/teacher"
        homeLabel="Início do professor"
        items={[{ label: "Turmas" }]}
      />
      <PageHeader
        title="Turmas"
        description="Gerencie suas turmas e acompanhe seus alunos."
        actions={
          <Link
            href="/teacher/sessoes/nova"
            className={`yas-button yas-button--secondary ${styles.lift}`}
          >
            <Icon name="plus" size={18} />
            Criar sessão
          </Link>
        }
      />
      <TeacherMetricGrid label="Resumo das turmas vinculadas">
        {kpis.map((kpi, index) => (
          <TeacherMetric
            key={kpi.label}
            icon={kpi.icon}
            tone={kpi.tone}
            label={kpi.label}
            value={kpi.value}
            caption={kpi.caption}
            enterStep={entranceStep(index)}
          />
        ))}
      </TeacherMetricGrid>
      <section aria-labelledby="cohorts-heading" className={styles.directory}>
        <div className={styles.sectionHeading}>
          <div className={styles.heading}>
            <h2 id="cohorts-heading">Suas turmas</h2>
            <Badge>{visible.length}</Badge>
            <Tooltip content="Até 50 turmas vinculadas. A busca considera os nomes e as prévias de até 20 alunos e 3 encontros por turma. Matrículas são contadas por turma.">
              <button type="button" className={styles.info} aria-label="Sobre esta lista">
                <Icon name="info" size={16} />
              </button>
            </Tooltip>
          </div>
          <div className={styles.tools}>
            <Input
              label="Buscar turmas"
              type="search"
              placeholder="Turma, aluno ou encontro…"
              value={query}
              onChange={(event) => {
                setEntrance(false);
                setQuery(event.target.value);
              }}
            />
            <Select
              label="Ordenar por"
              value={order}
              onChange={(event) => {
                setEntrance(false);
                setOrder(event.target.value as CohortOrder);
              }}
              options={[
                { value: "meeting", label: "Próximo encontro" },
                { value: "name", label: "Nome da turma" },
                { value: "students", label: "Mais alunos" },
              ]}
            />
          </div>
        </div>
        <p className="sr-only" role="status">
          {visible.length} {visible.length === 1 ? "turma encontrada" : "turmas encontradas"}
        </p>
        {!cohorts.length ? (
          <EmptyState
            title="Nenhuma turma vinculada"
            description="Suas turmas aparecerão aqui quando o administrador vincular você a elas."
          />
        ) : !visible.length ? (
          <EmptyState
            title="Nenhuma turma encontrada"
            description="Tente outro nome de turma, aluno ou encontro da prévia."
            action={{ label: "Limpar busca", variant: "outline", onClick: () => setQuery("") }}
          />
        ) : (
          <ul className={styles.grid} aria-label="Turmas pedagógicas atribuídas">
            {visible.map((cohort, index) => {
              const next = nextCohortSession(cohort);
              const tone = index % 3 === 1 ? "blue" : "lilac";
              return (
                <li key={cohort.id}>
                  <Card
                    className={`${styles.cohort} ${styles.enter}`}
                    data-accent={tone}
                    style={stagger(entranceStep(index, kpis.length))}
                    aria-labelledby={`cohort-${cohort.id}`}
                  >
                    <div className={styles.cardTop}>
                      <IconBadge icon="users" tone={tone} shape="square" />
                      <div className={styles.intro}>
                        <h3 id={`cohort-${cohort.id}`} title={cohort.name}>
                          {cohort.name}
                        </h3>
                      </div>
                      {!cohort.occupancy ? (
                        <Badge tone="muted">Sem alunos</Badge>
                      ) : !next ? (
                        <Badge tone="muted">Sem encontro</Badge>
                      ) : null}
                    </div>
                    <ul className={styles.meta}>
                      <li>
                        <Icon name="users" size={14} />
                        <span>
                          {cohort.occupancy} {cohort.occupancy === 1 ? "aluno" : "alunos"}
                          {cohort.capacity !== null ? ` · ${cohort.capacity} vagas totais` : ""}
                        </span>
                      </li>
                      <li>
                        <Icon name="clock" size={14} />
                        <span>{cohortSchedule(cohort)}</span>
                      </li>
                      <li>
                        <Icon name="globe" size={14} />
                        <span>{cohort.timezone}</span>
                      </li>
                    </ul>
                    <div className={styles.roster}>
                      {cohort.occupancy > 0 && (
                        <div className={styles.rosterHeading}>
                          <strong>Alunos</strong>
                          <button
                            type="button"
                            className={styles.textLink}
                            onClick={() => setSelected(cohort)}
                          >
                            Ver todos ({cohort.occupancy})<Icon name="right" size={13} />
                          </button>
                        </div>
                      )}
                      <CohortStudents cohort={cohort} compact />
                    </div>
                    <div className={styles.event}>
                      <div className={styles.eventHeading}>
                        <IconBadge icon="cal" size="sm" shape="square" />
                        <strong>Próximo encontro</strong>
                        <Link className={styles.textLink} href={cohortAgendaUrl(cohort.id)}>
                          Ver agenda
                          <Icon name="right" size={13} />
                        </Link>
                      </div>
                      {next ? (
                        <div className={styles.eventBody}>
                          <Link href={`/teacher/sessoes/${next.id}`}>{next.title}</Link>
                          <small>
                            <Icon name="clock" size={14} />
                            {dateLabel(next.starts_at, cohort.timezone)}
                          </small>
                        </div>
                      ) : (
                        <p>Nenhum encontro agendado</p>
                      )}
                    </div>
                    <div className={styles.actions}>
                      <Button
                        variant="secondary"
                        className={styles.lift}
                        leadingIcon={<Icon name="book" size={17} />}
                        onClick={() => setSelected(cohort)}
                        aria-label={`Ver turma ${cohort.name}`}
                      >
                        Ver turma
                      </Button>
                      <Link
                        className="yas-button yas-button--outline"
                        href={cohortAgendaUrl(cohort.id)}
                        aria-label={`Gerenciar sessões de ${cohort.name}`}
                      >
                        <Icon name="cal" size={17} />
                        Sessões
                      </Link>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <Drawer
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        title={selected?.name ?? "Detalhes da turma"}
        description="Alunos e próximos encontros da turma."
        size="lg"
        footer={
          selected ? (
            <div className={styles.actions}>
              <Link
                className={`yas-button yas-button--secondary ${styles.lift}`}
                href={cohortAgendaUrl(selected.id)}
              >
                Abrir agenda
                <Icon name="right" size={16} />
              </Link>
              <Button variant="outline" onClick={() => setSelected(null)}>
                Fechar
              </Button>
            </div>
          ) : undefined
        }
      >
        {selected && (
          <div className={styles.detail}>
            <Badge tone="success" icon="check-c">
              Vínculo vigente
            </Badge>
            <p className={styles.detailSchedule}>
              <Icon name="clock" size={17} />
              {cohortSchedule(selected)}
              <br />
              {selected.timezone}
            </p>
            <div className={styles.detailStats}>
              <div>
                <span>Alunos</span>
                <strong>{selected.occupancy}</strong>
              </div>
              <div>
                <span>Capacidade</span>
                <strong>{selected.capacity ?? "Não definida"}</strong>
              </div>
              <div>
                <span>Vagas livres</span>
                <strong>
                  {selected.capacity === null
                    ? "Não definida"
                    : Math.max(0, selected.capacity - selected.occupancy)}
                </strong>
              </div>
            </div>
            <section>
              <div className={styles.rosterHeading}>
                <h3>Alunos matriculados</h3>
                <Link className={styles.textLink} href={cohortStudentsUrl(selected.id)}>
                  Abrir lista completa
                  <Icon name="right" size={14} />
                </Link>
              </div>
              <CohortStudents cohort={selected} />
            </section>
            <section>
              <h3>Próximos encontros</h3>
              {selected.next_sessions.length ? (
                <ul className={styles.meetings}>
                  {[...selected.next_sessions]
                    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))
                    .map((session) => (
                      <li key={session.id}>
                        <Link href={`/teacher/sessoes/${session.id}`}>
                          <Icon name="cal" size={20} />
                          <span>
                            <strong>{session.title}</strong>
                            <small>{dateLabel(session.starts_at, selected.timezone)}</small>
                          </span>
                          <Icon name="right" size={16} />
                        </Link>
                      </li>
                    ))}
                </ul>
              ) : (
                <p className={styles.muted}>Nenhum encontro agendado.</p>
              )}
              <p className={styles.previewNote}>
                Prévia dos próximos 3 encontros. Consulte a agenda para ver todas as sessões.
              </p>
            </section>
            <p className={styles.footnote}>
              Alterações de cadastro, matrícula e capacidade são realizadas pelo administrador.
            </p>
          </div>
        )}
      </Drawer>
    </div>
  );
}
