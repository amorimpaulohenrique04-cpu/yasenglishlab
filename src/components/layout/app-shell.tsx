import type { ReactNode } from "react";

export interface AppShellProps {
  sidebar: ReactNode;
  topbar: ReactNode;
  children: ReactNode;
}

export function AppShell({ sidebar, topbar, children }: AppShellProps) {
  return (
    <div className="yas-app-shell">
      {sidebar}
      <div className="yas-app-shell-main">
        {topbar}
        <main>{children}</main>
      </div>
    </div>
  );
}
