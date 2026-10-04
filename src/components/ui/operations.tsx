import type { FormHTMLAttributes, ReactNode } from "react";

import { cx } from "./utils";

export interface DataTableColumn {
  id: string;
  label: string;
  align?: "start" | "end";
}

export interface DataTableRow {
  id: string;
  cells: readonly ReactNode[];
  mobile: ReactNode;
}

export function DataTable({
  caption,
  columns,
  rows,
}: {
  caption: string;
  columns: readonly DataTableColumn[];
  rows: readonly DataTableRow[];
}) {
  return (
    <>
      <div className="yas-data-table-frame">
        <table className="yas-data-table">
          <caption>{caption}</caption>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.id} scope="col" data-align={column.align ?? "start"}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                {row.cells.map((cell, index) => (
                  <td key={columns[index]?.id ?? index}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="yas-responsive-data-list" aria-label={caption}>
        {rows.map((row) => (
          <li key={row.id}>{row.mobile}</li>
        ))}
      </ul>
    </>
  );
}

export function ResponsiveDataList({ label, children }: { label: string; children: ReactNode }) {
  return (
    <ul className="yas-responsive-data-list yas-responsive-data-list--always" aria-label={label}>
      {children}
    </ul>
  );
}

export function FilterBar({ className, children, ...props }: FormHTMLAttributes<HTMLFormElement>) {
  return (
    <form {...props} className={cx("yas-filter-bar", className)}>
      {children}
    </form>
  );
}

export function MetricCard({
  label,
  value,
  detail,
  href,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  href?: string;
}) {
  const content = (
    <>
      <span className="yas-metric-label">{label}</span>
      <strong className="yas-metric-value">{value}</strong>
      {detail && <span className="yas-metric-detail">{detail}</span>}
    </>
  );

  return href ? (
    <a className="yas-metric-card" href={href}>
      {content}
    </a>
  ) : (
    <div className="yas-metric-card">{content}</div>
  );
}

export function KanbanBoard({
  label,
  columns,
}: {
  label: string;
  columns: readonly { id: string; title: string; count: number; children: ReactNode }[];
}) {
  return (
    <div className="yas-kanban-board" aria-label={label}>
      {columns.map((column) => (
        <section
          className="yas-kanban-column"
          key={column.id}
          aria-labelledby={`${column.id}-title`}
        >
          <header className="yas-kanban-heading">
            <h2 id={`${column.id}-title`}>{column.title}</h2>
            <span aria-label={`${column.count} itens`}>{column.count}</span>
          </header>
          <div className="yas-kanban-items">{column.children}</div>
        </section>
      ))}
    </div>
  );
}

export function ScheduleGrid({
  label,
  days,
}: {
  label: string;
  days: readonly { id: string; label: string; content: ReactNode }[];
}) {
  return (
    <div className="yas-schedule-grid" aria-label={label}>
      {days.map((day) => (
        <section className="yas-schedule-day" key={day.id} aria-labelledby={`${day.id}-label`}>
          <h3 id={`${day.id}-label`}>{day.label}</h3>
          <div className="yas-schedule-slots">{day.content}</div>
        </section>
      ))}
    </div>
  );
}
