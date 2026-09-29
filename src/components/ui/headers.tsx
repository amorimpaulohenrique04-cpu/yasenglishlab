import type { ReactNode } from "react";

export interface HeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function SectionHeader({ title, description, actions }: HeaderProps) {
  return (
    <header className="yas-section-header">
      <div>
        <h2>{title}</h2>
        {description && <p className="yas-header-description">{description}</p>}
      </div>
      {actions && <div className="yas-cluster">{actions}</div>}
    </header>
  );
}

export function PageHeader({ title, description, actions }: HeaderProps) {
  return (
    <header className="yas-page-header">
      <div>
        <h1>{title}</h1>
        {description && <p className="yas-header-description">{description}</p>}
      </div>
      {actions && <div className="yas-cluster">{actions}</div>}
    </header>
  );
}
