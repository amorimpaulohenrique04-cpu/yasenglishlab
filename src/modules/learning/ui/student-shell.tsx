"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

import { AppShell, ContentContainer, Sidebar, Topbar } from "@/components/layout";
import { Avatar, Drawer, IconButton } from "@/components/ui";

const navigation = [
  { id: "home", label: "Início", href: "/home" },
  { id: "lessons", label: "Aulas", href: "/aulas" },
  { id: "practice", label: "Prática", href: "/pratica" },
  { id: "materials", label: "Materiais", href: "/materiais" },
  { id: "schedule", label: "Agenda", href: "/agenda" },
] as const;

function HomeIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5 10.5V20h14v-9.5" />
    </svg>
  );
}

function LessonsIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z" />
      <path d="M4 5.5v16M8 7h8M8 11h6" />
    </svg>
  );
}

function MaterialsIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M15 3v5h5M9 12h7M9 16h7" />
    </svg>
  );
}

function ScheduleIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01" />
    </svg>
  );
}

function PracticeIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M4 13v-2a8 8 0 0 1 16 0v2" />
      <path d="M4 13h3v6H5a1 1 0 0 1-1-1zM20 13h-3v6h2a1 1 0 0 0 1-1z" />
    </svg>
  );
}

function navigationIcon(id: (typeof navigation)[number]["id"]) {
  if (id === "home") return <HomeIcon />;
  if (id === "practice") return <PracticeIcon />;
  if (id === "materials") return <MaterialsIcon />;
  if (id === "schedule") return <ScheduleIcon />;
  return <LessonsIcon />;
}

export function StudentShell({
  displayName,
  children,
}: {
  displayName: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const initials = displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  const sidebarItems = navigation.map((item) => ({
    ...item,
    icon: navigationIcon(item.id),
    active:
      item.href === "/home"
        ? pathname === "/home"
        : pathname === item.href || pathname.startsWith(`${item.href}/`),
  }));

  return (
    <AppShell
      sidebar={
        <Sidebar
          brand={
            <Link className="yas-student-brand" href="/home">
              <span>Yas</span>
              <small>English Lab</small>
            </Link>
          }
          items={sidebarItems}
          footer={<span>Learn. Speak. Keep going.</span>}
        />
      }
      topbar={
        <Topbar
          start={
            <>
              <span className="yas-student-mobile-menu">
                <IconButton label="Abrir navegação" onClick={() => setDrawerOpen(true)}>
                  ☰
                </IconButton>
              </span>
              <span className="yas-student-topbar-label">Portal do aluno</span>
            </>
          }
          end={
            <Link className="yas-student-profile-link" href="/profile">
              <Avatar fallback={initials || "YA"} label={displayName} size="sm" />
              <span>{displayName}</span>
            </Link>
          }
        />
      }
    >
      <ContentContainer>{children}</ContentContainer>
      <Drawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title="Navegação"
        description="Acesse as áreas principais do seu portal."
      >
        <nav className="yas-student-drawer-nav" aria-label="Navegação mobile">
          {navigation.map((item) => (
            <Link key={item.id} href={item.href} onClick={() => setDrawerOpen(false)}>
              {item.label}
            </Link>
          ))}
          <Link href="/profile" onClick={() => setDrawerOpen(false)}>
            Perfil
          </Link>
        </nav>
      </Drawer>
    </AppShell>
  );
}
