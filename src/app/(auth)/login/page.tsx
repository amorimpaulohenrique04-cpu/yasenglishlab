import Link from "next/link";

import { Alert, Button, Card, Input } from "@/components/ui";
import { sanitizeNextPath } from "@/modules/auth";

import { loginAction } from "./actions";

interface LoginPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : null;
  const reset = params.reset === "1";
  const next = sanitizeNextPath(typeof params.next === "string" ? params.next : null, "/home");

  return (
    <main className="yas-auth-shell">
      <Card className="yas-auth-card">
        <div className="yas-stack">
          <div>
            <p className="yas-auth-eyebrow">Yas English Lab</p>
            <h1 className="yas-auth-title">Entrar</h1>
            <p className="yas-auth-copy">Acesse sua conta com seu e-mail e senha.</p>
          </div>

          {error && (
            <Alert
              tone="error"
              title="Não foi possível entrar"
              description="Confira seus dados e tente novamente."
            />
          )}
          {reset && (
            <Alert
              tone="success"
              title="Senha atualizada"
              description="Entre novamente com sua nova senha."
            />
          )}

          <form action={loginAction} className="yas-stack">
            <input type="hidden" name="next" value={next} />
            <Input label="E-mail" name="email" type="email" autoComplete="email" required />
            <Input
              label="Senha"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
            <Button type="submit" variant="secondary">
              Entrar
            </Button>
          </form>

          <Link href="/forgot-password" className="yas-auth-link">
            Esqueci minha senha
          </Link>
        </div>
      </Card>
    </main>
  );
}
