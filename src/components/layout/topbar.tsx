import type { ReactNode } from "react";

export interface TopbarProps {
  start?: ReactNode;
  end?: ReactNode;
}

export function Topbar({ start, end }: TopbarProps) {
  return (
    <header className="yas-topbar">
      <div className="yas-topbar-start">{start}</div>
      <div className="yas-topbar-end">{end}</div>
    </header>
  );
}
