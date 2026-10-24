"use client";

import type { ReactNode } from "react";

import { RoleShell, type RoleNavItem } from "@/components/layout";
import { Avatar } from "@/components/ui";
import { nameInitials } from "@/lib/initials";

import type { TeacherSearchIndex } from "../domain/search-index";
import { TeacherSearchProvider, TeacherSearchTrigger } from "./session-command-palette";

const placementPath = "/teacher/revisoes/placement";

const navigation: readonly RoleNavItem[] = [
  { id: "home", label: "Início", href: "/teacher", icon: "grid" },
  { id: "sessions", label: "Sessões", href: "/teacher/sessoes", icon: "video", group: "Aulas" },
  { id: "cohorts", label: "Turmas", href: "/teacher/turmas", icon: "layers", group: "Aulas" },
  { id: "students", label: "Alunos", href: "/teacher/alunos", icon: "users", group: "Aulas" },
  {
    id: "reviews",
    label: "Revisões",
    href: "/teacher/revisoes",
    icon: "mic",
    group: "Revisões",
    match: (pathname) =>
      pathname === "/teacher/revisoes" ||
      (pathname.startsWith("/teacher/revisoes/") && !pathname.startsWith(placementPath)),
  },
  { id: "placement", label: "Entrada", href: placementPath, icon: "inbox", group: "Revisões" },
  { id: "practices", label: "Práticas", href: "/teacher/praticas", icon: "pen", group: "Revisões" },
  {
    id: "availability",
    label: "Disponibilidade",
    href: "/teacher/disponibilidade",
    icon: "cal",
    group: "Agenda",
  },
];

export function TeacherShell({
  displayName,
  verifiedSession = false,
  loadSearchIndex,
  children,
}: {
  displayName: string;
  verifiedSession?: boolean;
  loadSearchIndex?: () => Promise<TeacherSearchIndex>;
  children: ReactNode;
}) {
  const initials = nameInitials(displayName, "YA");

  return (
    <TeacherSearchProvider loadIndex={loadSearchIndex}>
      <RoleShell
        displayName={displayName}
        homeHref="/teacher"
        items={navigation}
        role="Professor"
        roleIcon="teacher"
        sidebarLabel="Navegação do professor"
        menuButtonLabel="Abrir navegação do professor"
        drawerTitle="Navegação do professor"
        drawerDescription="Acesse suas operações de aula."
        drawerNavLabel="Navegação mobile do professor"
        verifiedSession={verifiedSession}
        topbarActions={<TeacherSearchTrigger />}
        sidebarFooter={
          <div className="yas-sidebar-card">
            <Avatar fallback={initials} label={displayName} size="sm" />
            <span>
              <strong>{displayName}</strong>
              <small>Professor</small>
            </span>
          </div>
        }
      >
        {children}
      </RoleShell>
    </TeacherSearchProvider>
  );
}
