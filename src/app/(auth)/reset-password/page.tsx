import { Alert, Button, Card, Input } from "@/components/ui";
import { requirePageAuth } from "@/server/auth/guards";

import { updatePasswordAction } from "./actions";

interface ResetPasswordPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps) {
  await requirePageAuth({ enforceStaffMfa: false });
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : null;

  return (
    <main className="yas-auth-shell">
      <Card className="yas-auth-card">
        <div className="yas-stack">
          <div>
            <p className="yas-auth-eyebrow">Yas English Lab</p>
            <h1 className="yas-auth-title">Definir nova senha</h1>
            <p className="yas-auth-copy">Use pelo menos 12 caracteres.</p>
          </div>

          {error && (
            <Alert
              tone="error"
              title="Não foi possível alterar a senha"
              description="Revise os campos e tente novamente."
            />
          )}

          <form action={updatePasswordAction} className="yas-stack">
            <Input
              label="Nova senha"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={12}
              required
            />
            <Input
              label="Confirmar nova senha"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={12}
              required
            />
            <Button type="submit" variant="secondary">
              Alterar senha
            </Button>
          </form>
        </div>
      </Card>
    </main>
  );
}
