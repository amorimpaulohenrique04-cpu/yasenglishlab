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
            <Link className={styles.brand} href={contentHref}>
              <span>Yas</span>
              <small>English Lab · Administração</small>
            </Link>
          }
          items={items}
          footer={<span>Administração de conteúdo</span>}
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
              <span className={styles.topbarLabel}>Área administrativa</span>
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
        description="Acesse a administração de conteúdo."
      >
        <nav className={styles.drawerNav} aria-label="Navegação administrativa no celular">
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
