"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

import { AppShell, ContentContainer, Sidebar, Topbar } from "@/components/layout";
import { Avatar, Drawer, IconButton } from "@/components/ui";

const navigation = [
  { id: "home", label: "Início", href: "/home" },
  { id: "lessons", label: "Aulas", href: "/aulas" },
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
    .split(/s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  const sidebarItems = navigation.map((item) => ({
    ...item,
    icon: item.id === "home" ? <HomeIcon /> : <LessonsIcon />,
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
