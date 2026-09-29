import type { ReactNode } from "react";

import { requirePageAuth } from "@/server/auth/guards";

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  await requirePageAuth();
  return children;
}
