import { redirect } from "next/navigation";

import { Card } from "@/components/ui";
import { authContinuePath, staffMfaRequired } from "@/modules/auth";
import { requirePageAuth } from "@/server/auth/guards";

import { MfaPanel } from "./mfa-panel";

interface MfaPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function MfaPage({ searchParams }: MfaPageProps) {
  const auth = await requirePageAuth({ enforceStaffMfa: false });
  const params = await searchParams;
  const nextPath = authContinuePath(typeof params.next === "string" ? params.next : null);
  const required = staffMfaRequired(auth.roles, auth.aal);

  if (auth.aal === "aal2") {
    redirect(nextPath);
  }

  return (
    <main className="yas-auth-shell">
      <Card className="yas-auth-card">
        <div className="yas-stack">
          <div>
            <p className="yas-auth-eyebrow">Segurança da conta</p>
            <h1 className="yas-auth-title">
              {required
                ? "Verificação em duas etapas obrigatória"
                : "Ativar verificação em duas etapas"}
            </h1>
            <p className="yas-auth-copy">
              {required
                ? "Contas de professor, suporte e administrador precisam atingir AAL2 antes de acessar dados de trabalho."
                : "Use um aplicativo autenticador para adicionar uma segunda camada de proteção."}
            </p>
          </div>
          <MfaPanel nextPath={nextPath} />
        </div>
      </Card>
    </main>
  );
}
