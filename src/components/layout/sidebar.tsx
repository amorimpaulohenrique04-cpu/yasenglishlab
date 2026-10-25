import Link from "next/link";
import { useId, type ReactNode } from "react";

export interface SidebarItem {
  id: string;
  label: string;
  href: string;
  icon?: ReactNode;
  active?: boolean;
  /** Rótulo de grupo; um título é exibido quando o grupo muda. */
  group?: string | undefined;
  /** Contador ou marcador à direita (ex.: itens pendentes). */
  badge?: ReactNode;
}

export interface SidebarProps {
  brand: ReactNode;
  items: readonly SidebarItem[];
  footer?: ReactNode;
  ariaLabel?: string;
  /** Linha curta abaixo da marca (ex.: "Administração"). */
  role?: ReactNode;
}

function SidebarWave() {
  return (
    <svg
      className="yas-sidebar-wave"
      viewBox="0 0 260 230"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M0 70 C60 10 110 10 150 55 S230 120 260 60 V230 H0Z"
        fill="var(--yas-color-sidebar-wave-1)"
        opacity=".55"
      />
      <path
        d="M0 105 C55 60 120 70 160 100 S235 140 260 105 V230 H0Z"
        fill="var(--yas-color-sidebar-wave-2)"
        opacity=".35"
      />
    </svg>
  );
}

export function Sidebar({
  brand,
  items,
  footer,
  role,
  ariaLabel = "Navegação principal",
}: SidebarProps) {
  const idPrefix = useId();
  // Consecutive items sharing a group become one labelled list.
  const sections: { group: string | undefined; items: SidebarItem[] }[] = [];
  for (const item of items) {
    const last = sections[sections.length - 1];
    if (last && last.group === item.group) last.items.push(item);
    else sections.push({ group: item.group, items: [item] });
  }

  return (
    <aside className="yas-sidebar" data-dense={items.length >= 12 || undefined}>
      <div className="yas-sidebar-brand">{brand}</div>
      {role && <span className="yas-sidebar-role">{role}</span>}
      <nav className="yas-sidebar-nav" aria-label={ariaLabel}>
        {sections.map((section, sectionIndex) => {
          const headingId = `${idPrefix}-group-${sectionIndex}`;
          return (
            <div key={`${section.group ?? "ungrouped"}-${sectionIndex}`}>
              {section.group && (
                <span className="yas-sidebar-group" id={headingId}>
                  {section.group}
                </span>
              )}
              <ul
                className="yas-sidebar-list"
                aria-labelledby={section.group ? headingId : undefined}
              >
                {section.items.map((item) => (
                  <li key={item.id}>
                    <Link
                      className="yas-sidebar-link"
                      href={item.href}
                      aria-current={item.active ? "page" : undefined}
                    >
                      {item.icon && (
                        <span className="yas-sidebar-icon" aria-hidden="true">
                          {item.icon}
                        </span>
                      )}
                      <span>{item.label}</span>
                      {item.badge !== undefined && item.badge !== null && (
                        <span className="yas-sidebar-badge">{item.badge}</span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>
      <div className="yas-sidebar-footer">
        <SidebarWave />
        {footer}
      </div>
    </aside>
  );
}
