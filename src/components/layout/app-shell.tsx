import type { ReactNode } from "react";

export interface AppShellProps {
  sidebar: ReactNode;
  topbar: ReactNode;
  children: ReactNode;
  /** Barra de atalhos fixa no rodapé em telas pequenas. */
  bottomNav?: ReactNode;
}

function BackgroundWave() {
  return (
    <svg
      className="yas-app-shell-deco"
      viewBox="0 0 1200 340"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M520 0 C700 120 860 40 1000 90 S1160 200 1200 150 V0Z" fill="#e7defc" opacity=".8" />
      <path d="M640 0 C780 60 900 10 1040 40 S1170 110 1200 80 V0Z" fill="#ddd1fb" opacity=".55" />
    </svg>
  );
}

export function AppShell({ sidebar, topbar, children, bottomNav }: AppShellProps) {
  return (
    <div className="yas-app-shell" data-bottom-nav={bottomNav ? "true" : undefined}>
      {sidebar}
      <div className="yas-app-shell-main">
        <BackgroundWave />
        {topbar}
        <main>{children}</main>
      </div>
      {bottomNav}
    </div>
  );
}
