"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

import { AppShell, ContentContainer, Sidebar, Topbar } from "@/components/layout";
import { Avatar, Drawer, IconButton } from "@/components/ui";

import styles from "./admin-content.module.css";

const contentHref = "/admin/content?kind=courses";

export function AdminShell({
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
  const items = [
    {
      id: "overview",
      label: "Visão geral",
      href: "/admin",
      active: pathname === "/admin",
    },
    {
      id: "cohorts",
      label: "Turmas",
      href: "/admin/cohorts",
      active: pathname.startsWith("/admin/cohorts"),
    },
    {
      id: "students",
      label: "Alunos",
      href: "/admin/students",
      active: pathname.startsWith("/admin/students"),
    },
    {
      id: "leads",
      label: "Leads",
      href: "/admin/leads",
      active: pathname.startsWith("/admin/leads"),
    },
    {
      id: "teachers",
      label: "Professores",
      href: "/admin/teachers",
      active: pathname.startsWith("/admin/teachers"),
    },
    {
      id: "enrollments",
      label: "Matrículas",
      href: "/admin/enrollments",
      active: pathname.startsWith("/admin/enrollments"),
    },
    {
      id: "content",
      label: "Conteúdos",
      href: contentHref,
      active: pathname.startsWith("/admin/content"),
    },
  ];

  return (
    <AppShell
      sidebar={
        <Sidebar
          ariaLabel="Navegação administrativa"
          brand={
            <Link className={styles.brand} href="/admin">
              <span>Yas</span>
              <small>English Lab · Administração</small>
            </Link>
          }
          items={items}
          footer={
            <Link className={styles.sidebarFooterLink} href={contentHref}>
              <span className={styles.sidebarFooterMark} aria-hidden="true">
                AD
              </span>
              <span>
                <strong>Administração</strong>
                <small>Conteúdos e operação</small>
              </span>
            </Link>
          }
        />
      }
      topbar={
        <Topbar
          start={
            <>
              <span className={styles.mobileMenu}>
                <IconButton
                  label="Abrir navegação administrativa"
                  onClick={() => setDrawerOpen(true)}
                >
                  ☰
                </IconButton>
              </span>
              <span className={styles.topbarLabel}>Operações administrativas</span>
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
        title="Navegação administrativa"
        description="Acesse as áreas administrativas."
      >
        <nav className={styles.drawerNav} aria-label="Navegação administrativa no celular">
          <Link href="/admin" onClick={() => setDrawerOpen(false)}>
            Visão geral
          </Link>
          <Link href="/admin/cohorts" onClick={() => setDrawerOpen(false)}>
            Turmas
          </Link>
          <Link href="/admin/students" onClick={() => setDrawerOpen(false)}>
            Alunos
          </Link>
          <Link href="/admin/leads" onClick={() => setDrawerOpen(false)}>
            Leads
          </Link>
          <Link href="/admin/teachers" onClick={() => setDrawerOpen(false)}>
            Professores
          </Link>
          <Link href="/admin/enrollments" onClick={() => setDrawerOpen(false)}>
            Matrículas
          </Link>
          <Link href={contentHref} onClick={() => setDrawerOpen(false)}>
            Conteúdos
          </Link>
          <Link href="/profile" onClick={() => setDrawerOpen(false)}>
            Perfil
          </Link>
        </nav>
      </Drawer>
    </AppShell>
  );
}
