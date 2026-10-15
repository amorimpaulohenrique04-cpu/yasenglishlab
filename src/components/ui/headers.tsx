import type { ReactNode } from "react";

export interface HeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export interface PageHeaderProps extends HeaderProps {
  /** Frase manuscrita da marca (assinatura pontual, só desktop). */
  tagline?: boolean;
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

export function PageHeader({ title, description, actions, tagline = false }: PageHeaderProps) {
  return (
    <header className="yas-page-header">
      <div>
        <h1>{title}</h1>
        {description && <p className="yas-header-description">{description}</p>}
      </div>
      {actions && <div className="yas-cluster">{actions}</div>}
      {tagline && !actions && (
        // eslint-disable-next-line @next/next/no-img-element -- decorative brand handwriting
        <img
          className="yas-page-header-tagline"
          src="/brand/tagline.png"
          alt=""
          aria-hidden="true"
          width={150}
          height={96}
        />
      )}
    </header>
  );
}
