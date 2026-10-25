import type { CSSProperties } from "react";
import { Alert, Icon, type IconName } from "@/components/ui";
import { sessionTypes } from "../domain/session-workspace";
import {
  reportDefinitions,
  reportDelta,
  reportInsights,
  type ReportDelta,
  type SessionReport,
} from "../domain/session-report";
import { teacherSessionTypeLabel } from "../domain/models";
import { formatDay } from "../domain/session-calendar";
import { ReportKpi, ReportSessionsTable } from "./session-report-parts";
import { SessionsAreaChart, TypeDonut } from "./session-charts";
import styles from "./sessions.module.css";

const hours = (minutes: number) =>
  `${(minutes / 60).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}h`;

export function SessionReportView({ report }: { report: SessionReport }) {
  const s = report.summary,
    p = report.previous;
  const previousRange = `${formatDay(report.previousStart, "short")} – ${formatDay(report.filters.from, "short")} (exclusivo)`;
  const metrics: {
    id: string;
    label: string;
    icon: IconName;
    tone: string;
    value: number | null;
    unit: "count" | "percent" | "hours";
    delta: ReportDelta | null;
    previous: string;
  }[] = [
    {
      id: "completed",
      label: "Sessões concluídas",
      icon: "check-c",
      tone: "lilac",
      value: s.completed,
      unit: "count",
      delta: reportDelta(s.completed, p.completed),
      previous: `${p.completed} no período anterior`,
    },
    {
      id: "rate",
      label: "Presença registrada",
      icon: "users",
      tone: "green",
      value: s.rate,
      unit: "percent",
      delta: reportDelta(s.rate, p.rate, { points: true }),
      previous:
        p.rate === null
          ? "Sem marcações no período anterior"
          : `${p.rate.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% no período anterior`,
    },
    {
      id: "hours",
      label: "Horas previstas das concluídas",
      icon: "clock",
      tone: "yellow",
      value: s.minutes / 60,
      unit: "hours",
      delta: reportDelta(s.minutes, p.minutes),
      previous: `${hours(p.minutes)} no período anterior`,
    },
    {
      id: "cancelled",
      label: "Cancelamentos",
      icon: "x-c",
      tone: "pink",
      value: s.cancelled,
      unit: "count",
      delta: reportDelta(s.cancelled, p.cancelled, { lowerIsBetter: true }),
      previous: `${p.cancelled} no período anterior`,
    },
  ];
  const counts = Object.fromEntries(
    sessionTypes.map((type) => [type, report.rows.filter((r) => r.session_type === type).length]),
  ) as Record<(typeof sessionTypes)[number], number>;
  const labels = Object.fromEntries(
    sessionTypes.map((type) => [type, teacherSessionTypeLabel(type)]),
  ) as Record<(typeof sessionTypes)[number], string>;
  const insights = reportInsights(report);
  const topCohorts = report.cohorts.slice(0, 6);

  return (
    <div className={styles.reportStack}>
      <div className={styles.kpis}>
        {metrics.map((metric, index) => (
          <ReportKpi key={metric.id} index={index} {...metric} compareRange={previousRange} />
        ))}
      </div>
      {s.pending > 0 && (
        <Alert
          tone="info"
          title={`${s.pending} ${s.pending === 1 ? "reserva com presença pendente" : "reservas com presença pendente"}`}
          description="Em sessões já iniciadas. Pendências não são consideradas faltas."
        />
      )}
      <div className={styles.chartRow}>
        <section
          className={`${styles.panel} yas-reveal`}
          style={{ "--yas-i": 1 } as CSSProperties}
          aria-labelledby="timeline-title"
        >
          <header className={styles.panelHeader}>
            <div>
              <h2 id="timeline-title">Sessões ao longo do tempo</h2>
              <p className={styles.muted}>Sessões por dia no período selecionado.</p>
            </div>
            <ul className={styles.chartLegend}>
              <li data-series="held">Não canceladas</li>
              <li data-series="done">Concluídas</li>
              <li data-series="cancelled">Canceladas</li>
            </ul>
          </header>
          {report.rows.length === 0 ? (
            <div className={styles.emptyInline}>
              <Icon name="bars" size={22} />
              <p>
                <strong>Nenhuma sessão no período</strong>
                <span>Ajuste os filtros para consultar outros encontros.</span>
              </p>
            </div>
          ) : (
            <SessionsAreaChart days={report.days} />
          )}
          <details className={styles.disclosure}>
            <summary>Ver valores por dia</summary>
            <div
              className={styles.tableWrap}
              tabIndex={0}
              role="region"
              aria-label="Valores por dia"
            >
              <table className={styles.table}>
                <caption className="sr-only">Sessões por dia</caption>
                <thead>
                  <tr>
                    <th scope="col">Data</th>
                    <th scope="col">Agendadas</th>
                    <th scope="col">Concluídas</th>
                    <th scope="col">Canceladas</th>
                  </tr>
                </thead>
                <tbody>
                  {report.days.map((d) => (
                    <tr key={d.date}>
                      <td>{formatDay(d.date, "numeric")}</td>
                      <td>{d.scheduled}</td>
                      <td>{d.completed}</td>
                      <td>{d.cancelled}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </section>
        <section
          className={`${styles.panel} yas-reveal`}
          style={{ "--yas-i": 2 } as CSSProperties}
          aria-labelledby="types-title"
        >
          <header className={styles.panelHeader}>
            <div>
              <h2 id="types-title">Distribuição por tipo</h2>
              <p className={styles.muted}>Todas as sessões do período, incluindo canceladas.</p>
            </div>
          </header>
          <TypeDonut counts={counts} labels={labels} />
        </section>
      </div>
      <div className={styles.chartRow}>
        <section
          className={`${styles.panel} yas-reveal`}
          style={{ "--yas-i": 3 } as CSSProperties}
          aria-labelledby="cohorts-title"
        >
          <header className={styles.panelHeader}>
            <div>
              <h2 id="cohorts-title">Principais turmas</h2>
              <p className={styles.muted}>Turmas com mais sessões no período.</p>
            </div>
          </header>
          {topCohorts.length === 0 ? (
            <p className={styles.muted}>Sem turmas no período.</p>
          ) : (
            <div
              className={styles.tableWrap}
              tabIndex={0}
              role="region"
              aria-label="Tabela de turmas"
            >
              <table className={`${styles.table} ${styles.rankTable}`}>
                <caption className="sr-only">
                  Sessões, presença e duração prevista por turma
                </caption>
                <thead>
                  <tr>
                    <th scope="col">#</th>
                    <th scope="col">Turma</th>
                    <th scope="col">Sessões</th>
                    <th scope="col">Concluídas</th>
                    <th scope="col">Presença</th>
                    <th scope="col">Horas</th>
                  </tr>
                </thead>
                <tbody>
                  {topCohorts.map((c, index) => (
                    <tr key={c.id ?? "none"}>
                      <td>
                        <span className={styles.rank} data-first={index === 0 || undefined}>
                          {index + 1}
                        </span>
                      </td>
                      <th scope="row">{c.name}</th>
                      <td>{c.sessions}</td>
                      <td>{c.completed}</td>
                      <td>
                        {c.rate === null ? (
                          <span className={styles.muted}>Sem marcações</span>
                        ) : (
                          <span className={styles.rateCell}>
                            <span className={styles.rateBar} aria-hidden="true">
                              <span style={{ width: `${c.rate}%` }} />
                            </span>
                            {c.rate.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
                          </span>
                        )}
                      </td>
                      <td>{hours(c.minutes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <section
          className={`${styles.panel} yas-reveal`}
          style={{ "--yas-i": 4 } as CSSProperties}
          aria-labelledby="insights-title"
        >
          <header className={styles.panelHeader}>
            <div>
              <h2 id="insights-title">Destaques do período</h2>
              <p className={styles.muted}>Fatos calculados a partir dos dados do relatório.</p>
            </div>
          </header>
          {insights.length === 0 ? (
            <p className={styles.muted}>
              Ainda não há base de comparação suficiente para destaques neste período.
            </p>
          ) : (
            <ul className={styles.insights}>
              {insights.map((insight) => (
                <li key={insight.id} data-tone={insight.tone}>
                  <span className={styles.insightIcon} aria-hidden="true">
                    <Icon
                      name={
                        insight.id === "peak"
                          ? "bars"
                          : insight.tone === "positive"
                            ? "trend-up"
                            : "trend-down"
                      }
                      size={18}
                    />
                  </span>
                  <span>
                    <strong>{insight.title}</strong>
                    <small>{insight.description}</small>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <section
        className={`${styles.panel} yas-reveal`}
        style={{ "--yas-i": 5 } as CSSProperties}
        aria-labelledby="rows-title"
      >
        <header className={styles.panelHeader}>
          <div>
            <h2 id="rows-title">Sessões do período</h2>
            <p className={styles.muted}>Registros usados nos indicadores.</p>
          </div>
        </header>
        <ReportSessionsTable rows={report.rows} />
      </section>
      <details className={`${styles.panel} ${styles.definitions}`}>
        <summary>
          <Icon name="alert" size={17} /> Como os números são calculados
        </summary>
        <p>{reportDefinitions}</p>
      </details>
    </div>
  );
}
