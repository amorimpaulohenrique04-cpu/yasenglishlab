import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui";
import { authorizedWorkspaces, authContinuePath } from "@/modules/auth";
import { requirePageAuth } from "@/server/auth/guards";

export default async function WorkspacePage() {
  const context = await requirePageAuth();
  const workspaces = authorizedWorkspaces(context.roles);
  if (workspaces.length < 2) redirect(authContinuePath());
  return (
    <main className="yas-auth-shell">
      <Card className="yas-auth-card">
        <div className="yas-stack">
          <h1>Escolha seu espaço de trabalho</h1>
          {workspaces.map((workspace) => (
            <Link
              key={workspace.role}
              href={authContinuePath(workspace.href)}
              className="yas-auth-link"
            >
              {workspace.label}
            </Link>
          ))}
        </div>
      </Card>
    </main>
  );
}
