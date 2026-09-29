import Link from "next/link";

import { Alert, Button, Card, Input } from "@/components/ui";

import { requestPasswordResetAction } from "./actions";

interface ForgotPasswordPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ForgotPasswordPage({ searchParams }: ForgotPasswordPageProps) {
  const params = await searchParams;
  const sent = params.sent === "1";

  return (
    <main className="yas-auth-shell">
      <Card className="yas-auth-card">
        <div className="yas-stack">
          <div>
            <p className="yas-auth-eyebrow">Yas English Lab</p>
            <h1 className="yas-auth-title">Recuperar senha</h1>
            <p className="yas-auth-copy">
              Informe seu e-mail. Se houver uma conta correspondente, enviaremos as instruções de
              recuperação.
            </p>
          </div>

          {sent && (
            <Alert
              tone="success"
              title="Confira seu e-mail"
              description="Se a conta existir, as instruções de recuperação serão enviadas."
            />
          )}

          <form action={requestPasswordResetAction} className="yas-stack">
            <Input label="E-mail" name="email" type="email" autoComplete="email" required />
            <Button type="submit" variant="secondary">
              Enviar instruções
            </Button>
          </form>

          <Link href="/login" className="yas-auth-link">
            Voltar para entrar
          </Link>
        </div>
      </Card>
    </main>
  );
}
