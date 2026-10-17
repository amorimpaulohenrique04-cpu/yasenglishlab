"use client";

import type { ReactNode } from "react";

import { RoleShell, type RoleNavItem } from "@/components/layout";
import { Avatar } from "@/components/ui";

const navigation: readonly RoleNavItem[] = [
  { id: "overview", label: "Visão geral", href: "/admin", icon: "grid" },
  {
    id: "enrollments",
    label: "Matrículas",
    href: "/admin/enrollments",
    icon: "inbox",
    group: "Pessoas",
  },
  { id: "students", label: "Alunos", href: "/admin/students", icon: "users", group: "Pessoas" },
  { id: "cohorts", label: "Turmas", href: "/admin/cohorts", icon: "layers", group: "Pessoas" },
  {
    id: "teachers",
    label: "Professores",
    href: "/admin/teachers",
    icon: "teacher",
    group: "Pessoas",
  },
  { id: "leads", label: "Leads", href: "/admin/leads", icon: "funnel", group: "Comercial" },
  { id: "billing", label: "Pagamentos", href: "/admin/billing", icon: "card", group: "Comercial" },
  {
    id: "incidents",
    label: "Ocorrências",
    href: "/admin/ocorrencias",
    icon: "alert",
    group: "Comercial",
  },
  { id: "support", label: "Suporte", href: "/admin/suporte", icon: "chat", group: "Comercial" },
  {
    id: "content",
    label: "Conteúdos",
    href: "/admin/content?kind=courses",
    icon: "book",
    group: "Conteúdo",
    match: (pathname) => pathname.startsWith("/admin/content"),
  },
  {
    id: "assessments",
    label: "Teste de entrada",
    href: "/admin/assessments",
    icon: "check-c",
    group: "Conteúdo",
  },
];

export function AdminShell({
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
      homeHref="/admin"
      items={navigation}
      role="Administração"
      sidebarLabel="Navegação administrativa"
      menuButtonLabel="Abrir navegação administrativa"
      drawerTitle="Navegação administrativa"
      drawerDescription="Acesse as áreas administrativas."
      drawerNavLabel="Navegação administrativa no celular"
      verifiedSession={verifiedSession}
      sidebarFooter={
        <div className="yas-sidebar-card">
          <Avatar fallback={initials || "YA"} label={displayName} size="sm" />
          <span>
            <strong>{displayName}</strong>
            <small>Administração</small>
          </span>
        </div>
      }
    >
      {children}
    </RoleShell>
  );
}
