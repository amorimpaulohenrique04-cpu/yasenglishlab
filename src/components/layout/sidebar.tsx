import type { ReactNode } from "react";

export interface SidebarItem {
  id: string;
  label: string;
  href: string;
  icon?: ReactNode;
  active?: boolean;
}

export interface SidebarProps {
  brand: ReactNode;
  items: readonly SidebarItem[];
  footer?: ReactNode;
  ariaLabel?: string;
}

export function Sidebar({ brand, items, footer, ariaLabel = "Navegação principal" }: SidebarProps) {
  return (
    <aside className="yas-sidebar">
      <div className="yas-sidebar-brand">{brand}</div>
      <nav className="yas-sidebar-nav" aria-label={ariaLabel}>
        <ul className="yas-sidebar-list">
          {items.map((item) => (
            <li key={item.id}>
              <a
                className="yas-sidebar-link"
                href={item.href}
                aria-current={item.active ? "page" : undefined}
              >
                {item.icon && <span aria-hidden="true">{item.icon}</span>}
                <span>{item.label}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>
      {footer && <div className="yas-sidebar-footer">{footer}</div>}
    </aside>
  );
}
