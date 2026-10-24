"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CommandPalette, Icon, type CommandItem } from "@/components/ui";
import type { TeacherSearchIndex } from "../domain/search-index";
import { teacherSessionStatusLabel, teacherSessionTypeLabel } from "../domain/models";
import { localParts, type WorkspaceSession } from "../domain/session-workspace";
import { formatDay } from "../domain/session-calendar";
import { sessionTypeMeta } from "./session-bits";

const INDEX_TTL_MS = 5 * 60 * 1000;
const OPEN_EVENT = "yas:session-search";

export function openSessionSearch() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

export type PaletteSession = Pick<
  WorkspaceSession,
  "id" | "title" | "starts_at" | "session_type" | "status" | "cohort_name" | "participant_search"
>;

interface TeacherSearchContextValue {
  open: () => void;
  setSessions: (sessions: readonly PaletteSession[]) => void;
}

const TeacherSearchContext = createContext<TeacherSearchContextValue | null>(null);

const sectionCommands: CommandItem[] = [
  { id: "go-home", group: "Ir para", label: "Início", icon: "grid", href: "/teacher" },
  {
    id: "go-sessions",
    group: "Ir para",
    label: "Sessões",
    icon: "video",
    href: "/teacher/sessoes",
  },
  { id: "go-cohorts", group: "Ir para", label: "Turmas", icon: "layers", href: "/teacher/turmas" },
  { id: "go-students", group: "Ir para", label: "Alunos", icon: "users", href: "/teacher/alunos" },
  { id: "go-reviews", group: "Ir para", label: "Revisões", icon: "mic", href: "/teacher/revisoes" },
  {
    id: "go-placement",
    group: "Ir para",
    label: "Entrada",
    description: "Testes de nível",
    icon: "inbox",
    href: "/teacher/revisoes/placement",
    keywords: "placement nivelamento",
  },
  {
    id: "go-practices",
    group: "Ir para",
    label: "Práticas",
    icon: "pen",
    href: "/teacher/praticas",
  },
  {
    id: "go-availability",
    group: "Ir para",
    label: "Disponibilidade",
    icon: "cal",
    href: "/teacher/disponibilidade",
  },
  { id: "go-profile", group: "Ir para", label: "Perfil", icon: "user", href: "/profile" },
];

/**
 * Teacher-wide Ctrl/⌘ K search. Lives in the shell so the shortcut works on every teacher page;
 * pages (the sessions area) feed it extra records through `TeacherSearchSessions`.
 */
export function TeacherSearchProvider({
  children,
  loadIndex,
}: {
  children: ReactNode;
  loadIndex?: (() => Promise<TeacherSearchIndex>) | undefined;
}) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState<TeacherSearchIndex | undefined>();
  const [loading, setLoading] = useState(false);
  const loadedAt = useRef(0);
  const inFlight = useRef(false);

  // Lazy: the index is fetched on first open, then at most every 5 minutes; failures retry on reopen.
  useEffect(() => {
    if (!open || !loadIndex || inFlight.current) return;
    if (Date.now() - loadedAt.current < INDEX_TTL_MS) return;
    inFlight.current = true;
    setLoading(true);
    loadIndex()
      .then((next) => {
        setIndex(next);
        loadedAt.current = Date.now();
      })
      .catch(() => undefined)
      .finally(() => {
        inFlight.current = false;
        setLoading(false);
      });
  }, [open, loadIndex]);
  const [sessions, setSessions] = useState<readonly PaletteSession[]>([]);

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, show);
    return () => window.removeEventListener(OPEN_EVENT, show);
  }, []);

  const value = useMemo<TeacherSearchContextValue>(
    () => ({ open: () => setOpen(true), setSessions }),
    [],
  );

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
      ...sectionCommands,
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
      ...(index?.students ?? []).map((student) => ({
        id: `student-${student.id}`,
        group: "Alunos",
        label: student.name,
        description: student.cohortNames.join(" · "),
        icon: "user" as const,
        keywords: student.cohortNames.join(" "),
        href: student.href,
      })),
      ...(index?.cohorts ?? []).map((cohort) => ({
        id: `cohort-${cohort.id}`,
        group: "Turmas",
        label: cohort.name,
        icon: "layers" as const,
        href: cohort.href,
      })),
      ...(loading && !index
        ? [
            {
              id: "index-loading",
              group: "Alunos",
              label: "Carregando…",
              description: "Alunos, turmas e revisões",
              icon: "search" as const,
            } as CommandItem,
          ]
        : []),
      ...(index?.reviews ?? []).map((review) => ({
        id: `review-${review.kind}-${review.id}`,
        group: "Revisões",
        label: review.title,
        description: review.kind === "entry" ? "Teste de nível" : "Prática",
        icon: (review.kind === "entry" ? "inbox" : "mic") as "inbox" | "mic",
        href: review.href,
      })),
    ],
    [sessions, index, loading],
  );

  return (
    <TeacherSearchContext.Provider value={value}>
      {children}
      <CommandPalette
        items={items}
        open={open}
        onOpenChange={setOpen}
        label="Busca rápida"
        placeholder="Página, sessão, aluno, turma ou ação…"
        empty="Nada encontrado."
      />
    </TeacherSearchContext.Provider>
  );
}

/** Topbar button that opens the palette; text on desktop, icon on mobile. */
export function TeacherSearchTrigger() {
  const search = useContext(TeacherSearchContext);
  return (
    <button
      type="button"
      className="yas-topbar-search"
      onClick={() => search?.open()}
      aria-keyshortcuts="Control+K Meta+K"
    >
      <Icon name="search" size={17} />
      {/* Name comes from the visible text (no aria-label), so it can't collide with page fields labelled "Buscar". */}
      <span className="yas-topbar-search-text">Buscar…</span>
      <kbd aria-hidden="true">Ctrl K</kbd>
    </button>
  );
}

/** Renders nothing; registers the teacher's sessions as palette results while mounted. */
export function TeacherSearchSessions({ sessions }: { sessions: readonly PaletteSession[] }) {
  const search = useContext(TeacherSearchContext);
  const setSessions = search?.setSessions;
  useEffect(() => {
    setSessions?.(sessions);
    return () => setSessions?.([]);
  }, [sessions, setSessions]);
  return null;
}
