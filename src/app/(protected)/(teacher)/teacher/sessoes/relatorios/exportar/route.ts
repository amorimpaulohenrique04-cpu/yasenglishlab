import { assertRole, AuthorizationError } from "@/server/auth/guards";
import { loadSessionReport } from "@/server/teacher-operations/session-report";
import { createSessionReportPdf } from "@/server/teacher-operations/session-report-pdf";
import { localParts } from "@/modules/teacher-operations/domain/session-workspace";
import {
  parseReportFilters,
  sessionReportCsv,
} from "@/modules/teacher-operations/domain/session-report";

export const runtime = "nodejs";
export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  try {
    await assertRole("TEACHER");
    const query = Object.fromEntries(new URL(request.url).searchParams);
    const format = query.format;
    if (format !== "csv" && format !== "pdf")
      return Response.json({ error: "Formato inválido." }, { status: 400, headers });
    const now = Date.now(),
      filters = parseReportFilters(query, localParts(new Date(now)).date);
    const { report } = await loadSessionReport(filters, now);
    const filename = `yas-sessoes-${filters.from}-${filters.to}.${format}`;
    const body =
      format === "pdf"
        ? new Uint8Array(await createSessionReportPdf(report))
        : sessionReportCsv(report);
    return new Response(body, {
      headers: {
        ...headers,
        "Content-Type": format === "pdf" ? "application/pdf" : "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    const status =
      error instanceof AuthorizationError
        ? error.code === "UNAUTHENTICATED"
          ? 401
          : 403
        : error instanceof RangeError
          ? 400
          : 500;
    return Response.json(
      {
        error:
          status === 500
            ? "Não foi possível exportar. Tente novamente."
            : status === 400
              ? "Filtros inválidos."
              : "Acesso não autorizado.",
      },
      { status, headers },
    );
  }
}
