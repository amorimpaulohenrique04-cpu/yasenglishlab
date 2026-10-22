"use client";

import { useEffect, useMemo, useState } from "react";
import { CommandPalette, type CommandItem } from "@/components/ui";
import { teacherSessionStatusLabel, teacherSessionTypeLabel } from "../domain/models";
import { localParts, type WorkspaceSession } from "../domain/session-workspace";
import { formatDay } from "../domain/session-calendar";
import { sessionTypeMeta } from "./session-bits";

const OPEN_EVENT = "yas:session-search";

export function openSessionSearch() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

export type PaletteSession = Pick<
  WorkspaceSession,
  "id" | "title" | "starts_at" | "session_type" | "status" | "cohort_name" | "participant_search"
>;

/** Ctrl/⌘ K search over the teacher's sessions plus the area shortcuts. */
export function SessionCommandPalette({ sessions }: { sessions: readonly PaletteSession[] }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, show);
    return () => window.removeEventListener(OPEN_EVENT, show);
  }, []);

  const items = useMemo<CommandItem[]>(
    () => [
      {
        id: "new",
        group: "Ações",
        label: "Criar sessão",
        description: "Agende um novo encontro",
        icon: "plus",
        href: "/teacher/sessoes/nova",
      },
      {
        id: "availability",
        group: "Ações",
        label: "Consultar disponibilidade",
        description: "Horários livres da semana",
        icon: "cal",
        href: "/teacher/sessoes?panel=availability",
      },
      {
        id: "meeting",
        group: "Ações",
        label: "Cadastrar link do Meet",
        description: "Vincule a sala de uma sessão",
        icon: "link",
        href: "/teacher/sessoes?panel=meeting",
      },
      {
        id: "reports",
        group: "Ações",
        label: "Ver relatórios",
        description: "Presença e participação",
        icon: "bars",
        href: "/teacher/sessoes/relatorios",
      },
      ...[...sessions]
        .sort((a, b) => b.starts_at.localeCompare(a.starts_at))
        .map((session) => ({
          id: session.id,
          group: "Sessões",
          label: session.title,
          description: [
            `${formatDay(localParts(session.starts_at).date, "short")} · ${localParts(session.starts_at).time}`,
            teacherSessionTypeLabel(session.session_type),
            session.cohort_name,
            teacherSessionStatusLabel(session.status),
          ]
            .filter(Boolean)
            .join(" · "),
          icon: sessionTypeMeta[session.session_type].icon,
          keywords: `${session.participant_search} ${session.cohort_name ?? ""}`,
          href: `/teacher/sessoes/${session.id}`,
        })),
    ],
    [sessions],
  );

  return (
    <CommandPalette
      items={items}
      open={open}
      onOpenChange={setOpen}
      label="Busca rápida"
      placeholder="Sessão, aluno, turma ou ação…"
      empty="Nenhuma sessão ou ação encontrada."
    />
  );
}
