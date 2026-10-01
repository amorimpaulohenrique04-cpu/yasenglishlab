"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

import { AppShell, ContentContainer, Sidebar, Topbar } from "@/components/layout";
import { Avatar, Drawer, IconButton } from "@/components/ui";

import styles from "./teacher-operations.module.css";

const navigation = [{ id: "sessions", label: "Sessões", href: "/teacher" }] as const;

function CalendarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </svg>
  );
}

export function TeacherShell({
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
    icon: <CalendarIcon />,
    active: pathname === item.href || pathname.startsWith(item.href + "/"),
  }));

  return (
    <AppShell
      sidebar={
        <Sidebar
          ariaLabel="Navegação do professor"
          brand={
            <Link className={styles.brand} href="/teacher">
              <span>Yas</span>
              <small>English Lab · Professor</small>
            </Link>
          }
          items={sidebarItems}
          footer={<span>Teacher Operations</span>}
        />
      }
      topbar={
        <Topbar
          start={
            <>
              <span className={styles.mobileMenu}>
                <IconButton label="Abrir navegação do professor" onClick={() => setDrawerOpen(true)}>
                  ☰
                </IconButton>
              </span>
              <span className={styles.topbarLabel}>Área do professor</span>
            </>
          }
          end={
            <Link className={styles.profileLink} href="/profile">
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
        title="Navegação do professor"
        description="Acesse suas operações de aula."
      >
        <nav className={styles.drawerNav} aria-label="Navegação mobile do professor">
          <Link href="/teacher" onClick={() => setDrawerOpen(false)}>
            Sessões
          </Link>
          <Link href="/profile" onClick={() => setDrawerOpen(false)}>
            Perfil
          </Link>
        </nav>
      </Drawer>
    </AppShell>
  );
}
