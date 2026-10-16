"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { RoleShell, type RoleNavItem } from "@/components/layout";
import { Icon } from "@/components/ui";

const navigation: readonly RoleNavItem[] = [
  { id: "home", label: "Início", href: "/home", icon: "home", shortcut: true },
  { id: "lessons", label: "Aulas", href: "/aulas", icon: "play-sq", shortcut: true },
  { id: "practice", label: "Prática", href: "/pratica", icon: "headphones", shortcut: true },
  { id: "materials", label: "Materiais", href: "/materiais", icon: "file" },
  { id: "progress", label: "Progresso", href: "/progresso", icon: "bars", shortcut: true },
  { id: "schedule", label: "Agenda", href: "/agenda", icon: "cal", shortcut: true },
];

export function StudentShell({
  displayName,
  children,
}: {
  displayName: string;
  children: ReactNode;
}) {
  return (
    <RoleShell
      displayName={displayName}
      homeHref="/home"
      items={navigation}
      sidebarLabel="Navegação principal"
      menuButtonLabel="Abrir navegação"
      drawerTitle="Navegação"
      drawerDescription="Acesse as áreas principais do seu portal."
      drawerNavLabel="Navegação mobile"
      sidebarFooter={
        <Link className="yas-sidebar-card" href="/support">
          <Icon name="headphones" />
          <span>
            <strong>Precisa de ajuda?</strong>
            <small>Veja as orientações</small>
          </span>
          <Icon name="arrow" size={16} />
        </Link>
      }
    >
      {children}
    </RoleShell>
  );
}
