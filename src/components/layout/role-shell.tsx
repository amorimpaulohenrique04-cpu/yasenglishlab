"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

import { Avatar, Drawer, Icon, IconButton, type IconName } from "@/components/ui";

import { AppShell } from "./app-shell";
import { ContentContainer } from "./content-container";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

export interface RoleNavItem {
  id: string;
  label: string;
  href: string;
  icon: IconName;
  group?: string;
  /** Rota ativa; padrão: igual ao href ou sub-rota dele. */
  match?: (pathname: string) => boolean;
  /** Aparece na barra inferior do celular (máx. 5). */
  shortcut?: boolean;
}

export interface RoleShellProps {
  displayName: string;
  homeHref: string;
  items: readonly RoleNavItem[];
  /** Rótulo acessível da navegação lateral. */
  sidebarLabel: string;
  /** Linha curta sob o logo (ex.: "Administração"). */
  role?: string;
  roleIcon?: IconName;
  menuButtonLabel: string;
  drawerTitle: string;
  drawerDescription: string;
  drawerNavLabel: string;
  /** Selo de sessão verificada (2FA) na topbar. */
  verifiedSession?: boolean;
  sidebarFooter?: ReactNode;
  children: ReactNode;
}

function initialsOf(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "YA"
  );
}

function isActive(item: RoleNavItem, pathname: string, homeHref: string) {
  if (item.match) return item.match(pathname);
  const path = item.href.split("?")[0] ?? item.href;
  if (path === homeHref) return pathname === path;
  return pathname === path || pathname.startsWith(`${path}/`);
}

function Brand({ href }: { href: string }) {
  return (
    <Link className="yas-brand" href={href}>
      {/* eslint-disable-next-line @next/next/no-img-element -- brand mark, fixed size */}
      <img src="/brand/logo.webp" alt="Yas English Lab" width={150} height={86} />
    </Link>
  );
}

export function RoleShell({
  displayName,
  homeHref,
  items,
  sidebarLabel,
  role,
  roleIcon = "shield",
  menuButtonLabel,
  drawerTitle,
  drawerDescription,
  drawerNavLabel,
  verifiedSession = false,
  sidebarFooter,
  children,
}: RoleShellProps) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const initials = initialsOf(displayName);
  const shortcuts = items.filter((item) => item.shortcut).slice(0, 5);

  const sidebarItems = items.map((item) => ({
    id: item.id,
    label: item.label,
    href: item.href,
    group: item.group,
    icon: <Icon name={item.icon} size={21} />,
    active: isActive(item, pathname, homeHref),
  }));

  const profileActive = pathname === "/profile" || pathname.startsWith("/profile/");

  return (
    <AppShell
      sidebar={
        <Sidebar
          ariaLabel={sidebarLabel}
          brand={<Brand href={homeHref} />}
          role={
            role ? (
              <>
                <Icon name={roleIcon} size={14} />
                {role}
              </>
            ) : undefined
          }
          items={sidebarItems}
          footer={sidebarFooter}
        />
      }
      topbar={
        <Topbar
          start={
            <>
              <span className="yas-topbar-mobile">
                <IconButton
                  className="yas-topbar-menu"
                  label={menuButtonLabel}
                  onClick={() => setDrawerOpen(true)}
                >
                  <Icon name="menu" size={22} />
                </IconButton>
                <Link className="yas-topbar-brand" href={homeHref}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- brand mark */}
                  <img src="/brand/logo.webp" alt="Yas English Lab" width={70} height={40} />
                </Link>
              </span>
            </>
          }
          end={
            <>
              {verifiedSession && (
                <span className="yas-session-badge">
                  <Icon name="shield" size={16} />
                  <span>Sessão verificada</span>
                </span>
              )}
              <Link
                className="yas-topbar-profile"
                href="/profile"
                aria-current={profileActive ? "page" : undefined}
              >
                <Avatar fallback={initials} label={displayName} size="md" />
                <span className="yas-topbar-profile-name">{displayName}</span>
              </Link>
            </>
          }
        />
      }
      bottomNav={
        shortcuts.length > 0 ? (
          <nav className="yas-bottom-nav" aria-label="Atalhos">
            {shortcuts.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                aria-current={isActive(item, pathname, homeHref) ? "page" : undefined}
              >
                <Icon name={item.icon} size={22} />
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
        ) : undefined
      }
    >
      <ContentContainer>{children}</ContentContainer>
      <Drawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title={drawerTitle}
        description={drawerDescription}
      >
        <nav className="yas-drawer-nav" aria-label={drawerNavLabel}>
          {items.map((item, index) => {
            const startsGroup = item.group && item.group !== items[index - 1]?.group;
            return (
              <div key={item.id} className="yas-drawer-nav-item">
                {startsGroup && (
                  <span className="yas-drawer-nav-group" aria-hidden="true">
                    {item.group}
                  </span>
                )}
                <Link
                  href={item.href}
                  aria-current={isActive(item, pathname, homeHref) ? "page" : undefined}
                  onClick={() => setDrawerOpen(false)}
                >
                  <Icon name={item.icon} size={20} />
                  {item.label}
                </Link>
              </div>
            );
          })}
          <div className="yas-drawer-nav-item">
            <Link
              href="/profile"
              aria-current={profileActive ? "page" : undefined}
              onClick={() => setDrawerOpen(false)}
            >
              <Icon name="user" size={20} />
              Perfil
            </Link>
          </div>
        </nav>
      </Drawer>
    </AppShell>
  );
}
