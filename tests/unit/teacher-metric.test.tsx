import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { TeacherMetric } from "@/modules/teacher-operations/ui/teacher-metric";

const render = (node: ReactNode) => renderToStaticMarkup(node);

describe("TeacherMetric", () => {
  it("renders a static card with label, value and caption", () => {
    const html = render(<TeacherMetric icon="users" label="Alunos" value={12} caption="ativos" />);
    expect(html).toContain("Alunos");
    expect(html).toContain("<strong");
    expect(html).toContain("12");
    expect(html).toContain("ativos");
    expect(html).not.toContain("<button");
    expect(html).not.toContain("<a ");
  });

  it("renders a button exposing aria-pressed when onClick is given", () => {
    const html = render(
      <TeacherMetric icon="users" label="Alunos" value={3} onClick={vi.fn()} pressed />,
    );
    expect(html).toContain("<button");
    expect(html).toContain('type="button"');
    expect(html).toContain('aria-pressed="true"');
  });

  it("renders a link when href is given", () => {
    const html = render(
      <TeacherMetric icon="users" label="Alunos" value={3} href="/teacher/alunos" />,
    );
    expect(html).toContain("<a ");
    expect(html).toContain('href="/teacher/alunos"');
    expect(html).not.toContain("<button");
  });
});
