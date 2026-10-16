"use client";

import type { ReactNode } from "react";

import { RoleShell, type RoleNavItem } from "@/components/layout";
import { Avatar } from "@/components/ui";

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
  children,
}: {
  displayName: string;
  verifiedSession?: boolean;
  children: ReactNode;
}) {
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
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
      sidebarFooter={
        <div className="yas-sidebar-card">
          <Avatar fallback={initials || "YA"} label={displayName} size="sm" />
          <span>
            <strong>{displayName}</strong>
            <small>Professor</small>
          </span>
        </div>
      }
    >
      {children}
    </RoleShell>
  );
}
