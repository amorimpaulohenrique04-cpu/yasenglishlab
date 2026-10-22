import Link from "next/link";
import { Card, EmptyState } from "@/components/ui";
import { comparison, localParts, sessionTypes } from "../domain/session-workspace";
import { reportDefinitions, type SessionReport } from "../domain/session-report";
import { teacherSessionStatusLabel, teacherSessionTypeLabel } from "../domain/models";
import styles from "./sessions.module.css";
import { SessionReportExport } from "./session-report-export";

export function SessionReportView({ report }: { report: SessionReport }) {
  const s = report.summary,
    p = report.previous;
  const metrics = [
    {
      label: "Sessões concluídas",
      value: String(s.completed),
      diff: comparison(s.completed, p.completed),
    },
    {
      label: "Presença registrada",
      value:
        s.rate === null
          ? "Sem marcações"
          : `${s.rate.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`,
      diff: comparison(s.rate, p.rate, true),
    },
    {
      label: "Horas previstas das concluídas",
      value: `${(s.minutes / 60).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}h`,
      diff: comparison(s.minutes, p.minutes),
    },
    {
      label: "Cancelamentos",
      value: String(s.cancelled),
      diff: comparison(s.cancelled, p.cancelled),
    },
  ];
  const max = Math.max(1, ...report.days.flatMap((d) => [d.scheduled, d.completed, d.cancelled]));
  const lines = [
    { key: "scheduled", label: "Agendadas", color: "#64488e", dash: "" },
    { key: "completed", label: "Concluídas", color: "#6024f7", dash: "5 3" },
    { key: "cancelled", label: "Canceladas", color: "#a21859", dash: "2 3" },
  ] as const;
  return (
    <div className={styles.stack}>
      <SessionReportExport filters={report.filters} />
      <div className={styles.metrics}>
        {metrics.map((m) => (
          <Card key={m.label}>
            <h2>{m.label}</h2>
            <p className={styles.metric}>{m.value}</p>
            <p>{m.diff}</p>
            <small>
              vs. {report.previousStart} a {report.filters.from} (exclusivo)
            </small>
          </Card>
        ))}
      </div>
      <p className={styles.notice}>
        {s.pending} reservas com presença pendente em sessões já iniciadas. Não são consideradas
        faltas.
      </p>
      {report.rows.length === 0 && (
        <EmptyState
          title="Nenhuma sessão no período"
          description="Ajuste os filtros para consultar outros encontros. Os indicadores refletem a ausência de registros."
        />
      )}
      <div className={styles.fields}>
        <Card>
          <h2>Sessões ao longo do tempo</h2>
          <div className={styles.legend}>
            {lines.map((l) => (
              <span key={l.key}>
                <svg width="28" height="10" aria-hidden="true">
                  <line
                    x1="0"
                    y1="5"
                    x2="28"
                    y2="5"
                    stroke={l.color}
                    strokeWidth="3"
                    strokeDasharray={l.dash}
                  />
                </svg>{" "}
                {l.label}
              </span>
            ))}
          </div>
          <svg
            className={styles.chart}
            viewBox="0 0 600 220"
            role="img"
            aria-label="Sessões por dia. Os valores completos estão na tabela diária abaixo."
          >
            <text x="5" y="15" fontSize="12">
              {max}
            </text>
            <path d="M30 20V195H585" fill="none" stroke="#b8adc9" />
            <text x="30" y="215" fontSize="12">
              {report.filters.from.slice(8)}/{report.filters.from.slice(5, 7)}
            </text>
            <text x="580" y="215" fontSize="12" textAnchor="end">
              {report.filters.to.slice(8)}/{report.filters.to.slice(5, 7)}
            </text>
            {lines.map((l) => (
              <polyline
                key={l.key}
                points={report.days
                  .map(
                    (d, i) =>
                      `${30 + (i * 550) / Math.max(1, report.days.length - 1)},${195 - (170 * d[l.key]) / max}`,
                  )
                  .join(" ")}
                fill="none"
                stroke={l.color}
                strokeWidth="3"
                strokeDasharray={l.dash}
              />
            ))}
          </svg>
          <details>
            <summary>Ver valores por dia</summary>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <caption>Sessões por dia</caption>
                <thead>
                  <tr>
                    <th>Data</th>
                    {lines.map((l) => (
                      <th key={l.key}>{l.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.days.map((d) => (
                    <tr key={d.date}>
                      <td>{d.date}</td>
                      <td>{d.scheduled}</td>
                      <td>{d.completed}</td>
                      <td>{d.cancelled}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </Card>
        <Card>
          <h2>Distribuição por tipo</h2>
          <p>Todas as sessões do período, incluindo canceladas.</p>
          <div className={styles.distribution}>
            {sessionTypes.map((type) => {
              const count = report.rows.filter((r) => r.session_type === type).length;
              return (
                <div key={type}>
                  <span>
                    {teacherSessionTypeLabel(type)} · {count}
                  </span>
                  <progress
                    aria-label={teacherSessionTypeLabel(type)}
                    value={count}
                    max={Math.max(1, report.rows.length)}
                  />
                </div>
              );
            })}
          </div>
        </Card>
      </div>
      <Card>
        <h2>Turmas no período</h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <caption>Sessões, presença e duração prevista por turma</caption>
            <thead>
              <tr>
                <th>Turma</th>
                <th>Sessões</th>
                <th>Concluídas</th>
                <th>Presença</th>
                <th>Horas previstas das concluídas</th>
              </tr>
            </thead>
            <tbody>
              {report.cohorts.map((c) => (
                <tr key={c.id ?? "none"}>
                  <td>{c.name}</td>
                  <td>{c.sessions}</td>
                  <td>{c.completed}</td>
                  <td>{c.rate === null ? "Sem marcações" : `${c.rate.toFixed(1)}%`}</td>
                  <td>{(c.minutes / 60).toFixed(1)}h</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card>
        <h2>Sessões do período</h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <caption>Registros usados nos indicadores</caption>
            <thead>
              <tr>
                <th>Sessão</th>
                <th>Início</th>
                <th>Status</th>
                <th>Presenças</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link href={`/teacher/sessoes/${r.id}`}>{r.title}</Link>
                    <br />
                    {r.cohort_name ?? "Sem turma"}
                  </td>
                  <td>
                    {localParts(r.starts_at).date} {localParts(r.starts_at).time}
                  </td>
                  <td>{teacherSessionStatusLabel(r.status)}</td>
                  <td>
                    {r.attended_count} presentes / {r.no_show_count} ausentes
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card>
        <h2>Como os números são calculados</h2>
        <p>{reportDefinitions}</p>
      </Card>
    </div>
  );
}
