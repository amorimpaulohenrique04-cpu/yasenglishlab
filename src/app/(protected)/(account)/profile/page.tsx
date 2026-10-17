import { StudentSubscription } from "@/modules/billing/ui/student-subscription";
import { cancelSubscriptionAction } from "./subscription-actions";
import { loadCurrentSubscriptionAccess } from "@/server/billing/subscription-access";
import { loadOwnSubscription } from "@/server/billing/own-subscription";
import { loadOwnRegularization } from "@/server/billing/regularization";
import { Alert, Avatar, Badge, Button, Card, Icon, Input, PageHeader } from "@/components/ui";
import { requirePageAuth } from "@/server/auth/guards";
import { createSupabaseServerClient } from "@/server/supabase/server";

import { logoutAction, updateProfileAction } from "./actions";

interface ProfilePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const roleLabels: Record<string, string> = {
  STUDENT: "Aluno",
  TEACHER: "Professor",
  ADMIN: "Administração",
};

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

  const isStudent = auth.roles.includes("STUDENT");
  const subscription = isStudent ? await loadOwnSubscription() : null;
  const access = isStudent ? await loadCurrentSubscriptionAccess() : ({ kind: "ok" } as const);
  const displayName = String(profile.display_name);
  const initials =
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "YA";

  return (
    <div className="yas-account-page">
      <PageHeader title="Seu perfil" description="Gerencie suas informações e preferências." />

      {params.profile === "updated" && <Alert tone="success" title="Perfil atualizado" />}
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

      <Card className="yas-account-identity">
        <Avatar fallback={initials} label={displayName} size="lg" />
        <div>
          <h2 className="yas-display">{displayName}</h2>
          <p className="yas-account-muted">{auth.email ?? "Conta autenticada"}</p>
          <div className="yas-cluster">
            {auth.roles.length > 0 ? (
              auth.roles.map((role) => <Badge key={role}>{roleLabels[role] ?? role}</Badge>)
            ) : (
              <Badge tone="muted">Sem papel atribuído</Badge>
            )}
            <Badge tone={auth.aal === "aal2" ? "success" : "muted"} icon="shield">
              {auth.aal === "aal2" ? "MFA verificado" : "Sessão AAL1"}
            </Badge>
          </div>
        </div>
        <form action={logoutAction}>
          <Button type="submit" variant="outline" leadingIcon={<Icon name="logout" size={18} />}>
            Sair
          </Button>
        </form>
      </Card>

      <div className="yas-account-grid">
        <Card>
          <div className="yas-card-header">
            <h2 className="yas-card-title">Dados pessoais</h2>
          </div>
          <form action={updateProfileAction} className="yas-account-form">
            <Input label="Nome" name="displayName" defaultValue={displayName} required />
            <Input label="Idioma" name="locale" defaultValue={String(profile.locale)} required />
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
        </Card>

        {isStudent && (
          <StudentSubscription
            subscription={subscription}
            access={access}
            cancelAction={cancelSubscriptionAction}
            regularization={
              subscription?.status === "PAST_DUE" ? await loadOwnRegularization() : undefined
            }
          />
        )}
      </div>
    </div>
  );
}
