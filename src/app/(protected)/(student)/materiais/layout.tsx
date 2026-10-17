import type { ReactNode } from "react";

import { requireDecisionConfirmed } from "@/server/placement/decision-gate";

export default async function PedagogicLayout({ children }: { children: ReactNode }) {
  await requireDecisionConfirmed();
  return children;
}
