import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { localParts } from "@/modules/teacher-operations/domain/session-workspace";
import {
  reportDefinitions,
  type SessionReport,
} from "@/modules/teacher-operations/domain/session-report";
import {
  teacherSessionStatusLabel,
  teacherSessionTypeLabel,
} from "@/modules/teacher-operations/domain/models";

export async function createSessionReportPdf(report: SessionReport) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(
    await readFile(path.join(process.cwd(), "public/fonts/report-noto-sans-regular.ttf")),
    { subset: true },
  );
  doc.setTitle("Yas English Lab - Relatório de sessões");
  doc.setLanguage("pt-BR");
  let page = doc.addPage([595.28, 841.89]),
    y = 780;
  const ink = rgb(0.12, 0.06, 0.25),
    purple = rgb(0.38, 0.14, 0.88);
  const newPage = () => {
    page = doc.addPage([595.28, 841.89]);
    y = 780;
  };
  const widths = new Map<string, number>();
  const width = (text: string, size: number) => {
    const key = `${size}:${text}`;
    let value = widths.get(key);
    if (value === undefined) {
      value = font.widthOfTextAtSize(text, size);
      widths.set(key, value);
    }
    return value;
  };
  const write = (text: string, size = 10, color = ink) => {
    // Wrap using actual font metrics. Newlines and unusually long words cannot escape the page.
    const clean = text.replace(/[\u0000-\u001f]/g, " ");
    const lines: string[] = [];
    let line = "",
      lineWidth = 0;
    for (const word of clean.split(/\s+/)) {
      const wordWidth = width(word, size);
      if (wordWidth > 499) {
        if (line) lines.push(line);
        line = "";
        lineWidth = 0;
        for (const char of word) {
          const charWidth = width(char, size);
          if (lineWidth + charWidth > 499 && line) {
            lines.push(line);
            line = "";
            lineWidth = 0;
          }
          line += char;
          lineWidth += charWidth;
        }
      } else {
        const gap = line ? width(" ", size) : 0;
        if (line && lineWidth + gap + wordWidth > 499) {
          lines.push(line);
          line = word;
          lineWidth = wordWidth;
        } else {
          line += (line ? " " : "") + word;
          lineWidth += gap + wordWidth;
        }
      }
    }
    if (line || !lines.length) lines.push(line);
    for (const value of lines) {
      if (y < 65) newPage();
      page.drawText(value, { x: 48, y, size, font, color });
      y -= size + 5;
    }
    y -= 4;
  };
  write("Yas English Lab", 22, purple);
  write("Relatório de sessões", 17);
  write(`${report.filters.from} a ${report.filters.to} | America/Recife`);
  write(
    `Turma: ${report.rows.find((r) => r.cohort_id === report.filters.cohort)?.cohort_name ?? (report.filters.cohort ? "Sem registros para a turma selecionada" : "Todas")}`,
  );
  write(
    `Tipo: ${report.filters.type ? teacherSessionTypeLabel(report.filters.type as Parameters<typeof teacherSessionTypeLabel>[0]) : "Todos"}`,
  );
  const s = report.summary;
  write(
    `Sessões concluídas: ${s.completed} | Horas previstas das concluídas: ${(s.minutes / 60).toFixed(1)}h`,
    12,
  );
  write(
    `Presença registrada: ${s.rate === null ? "Sem marcações" : `${s.rate.toFixed(1)}%`} | Pendências: ${s.pending} | Cancelamentos: ${s.cancelled}`,
    12,
  );
  write("Definições", 12, purple);
  write(reportDefinitions, 9);
  write("Sessões do período", 14, purple);
  if (!report.rows.length) write("Nenhuma sessão encontrada para estes filtros.");
  for (const session of report.rows) {
    if (y < 150) newPage();
    write(session.title, 12, purple);
    write(
      `${localParts(session.starts_at).date} ${localParts(session.starts_at).time} - ${localParts(session.ends_at).date} ${localParts(session.ends_at).time} | ${teacherSessionStatusLabel(session.status)}`,
    );
    write(
      `${teacherSessionTypeLabel(session.session_type)} | ${session.cohort_name ?? "Sem turma"} | Duração prevista: ${(Date.parse(session.ends_at) - Date.parse(session.starts_at)) / 60000} min`,
    );
    write(
      `Reservas ativas: ${session.participant_count} | Presentes: ${session.attended_count} | Ausentes: ${session.no_show_count}`,
    );
    y -= 8;
  }
  const pages = doc.getPages();
  pages.forEach((p, i) =>
    p.drawText(`Yas English Lab | ${i + 1} / ${pages.length}`, {
      x: 48,
      y: 32,
      font,
      size: 8,
      color: ink,
    }),
  );
  return doc.save();
}
