import { Alert, Badge, Button, Card, Input } from "@/components/ui";
import { requirePageAuth } from "@/server/auth/guards";
import { createSupabaseServerClient } from "@/server/supabase/server";

import { logoutAction, updateProfileAction } from "./actions";

interface ProfilePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ProfilePage({ searchParams }: ProfilePageProps) {
  const auth = await requirePageAuth();
  const supabase = await createSupabaseServerClient();
  const params = await searchParams;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("display_name, locale, timezone")
    .eq("user_id", auth.userId)
    .single();

  if (error || !profile) {
    throw new Error("Unable to load profile.");
  }

  return (
    <main className="yas-profile-shell">
      <div className="yas-profile-grid">
        <div>
          <p className="yas-auth-eyebrow">Yas English Lab</p>
          <h1 className="yas-auth-title">Seu perfil</h1>
          <p className="yas-profile-meta">{auth.email ?? "Conta autenticada"}</p>
        </div>

        {params.profile === "updated" && (
          <Alert tone="success" title="Perfil atualizado" />
        )}
        {(params.profile === "invalid" || params.profile === "error") && (
          <Alert
            tone="error"
            title="Não foi possível atualizar o perfil"
            description="Revise os campos e tente novamente."
          />
        )}
        {params.auth === "forbidden" && (
          <Alert
            tone="warning"
            title="Acesso não permitido"
            description="Sua conta não possui permissão para essa área."
          />
        )}

        <Card>
          <div className="yas-stack">
            <div>
              <strong>Permissões</strong>
              <div className="yas-cluster" style={{ marginTop: "0.75rem" }}>
                {auth.roles.length > 0 ? (
                  auth.roles.map((role) => <Badge key={role}>{role}</Badge>)
                ) : (
                  <Badge>SEM ROLE</Badge>
                )}
                <Badge tone={auth.aal === "aal2" ? "success" : "neutral"}>
                  {auth.aal === "aal2" ? "MFA verificado" : "Sessão AAL1"}
                </Badge>
              </div>
            </div>

            <form action={updateProfileAction} className="yas-stack">
              <Input
                label="Nome"
                name="displayName"
                defaultValue={String(profile.display_name)}
                required
              />
              <Input
                label="Idioma"
                name="locale"
                defaultValue={String(profile.locale)}
                required
              />
              <Input
                label="Fuso horário"
                name="timezone"
                defaultValue={String(profile.timezone)}
                required
              />
              <Button type="submit" variant="secondary">
                Salvar perfil
              </Button>
            </form>
          </div>
        </Card>

        <form action={logoutAction}>
          <Button type="submit" variant="outline">
            Sair
          </Button>
        </form>
      </div>
    </main>
  );
}
