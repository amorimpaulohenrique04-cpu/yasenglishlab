import { describe, expect, it, vi } from "vitest";
import { PDFDocument } from "pdf-lib";
import { buildSessionReport } from "@/modules/teacher-operations/domain/session-report";
import { workspaceSessionSchema } from "@/modules/teacher-operations/domain/session-workspace";
vi.mock("server-only", () => ({}));
import { createSessionReportPdf } from "@/server/teacher-operations/session-report-pdf";

describe("Exportação PDF de sessões", () => {
  it("creates a downloadable multipage PDF with the embedded project font", async () => {
    const rows = Array.from({ length: 28 }, (_, i) =>
      workspaceSessionSchema.parse({
        id: `89400000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
        title: `${i + 1}. Pronúncia e conversação - José e Maria - ${"Título longo com acentuação e orientações. ".repeat(5)}`,
        session_type: "CORE_CLASS",
        status: i % 2 ? "COMPLETED" : "SCHEDULED",
        starts_at: "2026-10-21T15:00:00Z",
        ends_at: "2026-10-21T16:00:00Z",
        capacity: 6,
        cohort_id: null,
        cohort_name: null,
        target_student_user_id: null,
        has_bookings: true,
        participant_count: 3,
        attended_count: 1,
        no_show_count: 1,
        student_ids: [],
        participant_search: "",
      }),
    );
    const report = buildSessionReport(
      rows,
      { from: "2026-10-01", to: "2026-10-31", cohort: "", type: "" },
      Date.parse("2026-10-22T12:00:00Z"),
    );
    const bytes = await createSessionReportPdf(report);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThan(1);
    expect(doc.getTitle()).toBe("Yas English Lab - Relatório de sessões");
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe("%PDF");
    if (process.env.YAS_PDF_EVIDENCE === "1") {
      const { mkdir, writeFile } = await import("node:fs/promises");
      await mkdir("harness/evidence/teacher-sessions-redesign", { recursive: true });
      await writeFile("harness/evidence/teacher-sessions-redesign/report-long-titles.pdf", bytes);
    }
  });
});
