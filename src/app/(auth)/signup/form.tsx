"use client";
import { useActionState } from "react";
import { Alert, Button, Input } from "@/components/ui";
import { signupAction, retryRegistrationAction, type SignupState } from "./actions";

export function SignupForm({ plan, retry }: { plan?: string | undefined; retry: boolean }) {
  const [state, action, pending] = useActionState(retry ? retryRegistrationAction : signupAction, {
    status: retry ? "retry" : "initial",
  } as SignupState);
  if (state.status === "email")
    return (
      <Alert
        tone="info"
        title="Confira seu e-mail"
        description="Se houver uma confirmação pendente, enviaremos as instruções para continuar. Se você já tem uma conta, entre para seguir com seu plano."
      />
    );
  const retrying = retry || state.status === "retry";
  if (retrying && !retry)
    return (
      <div className="yas-stack">
        <Alert
          tone="error"
          title="Seu cadastro ainda não foi concluído"
          description="Não foi possível preparar sua conta. Tente novamente para continuar."
        />
        <a
          className="yas-button yas-button--secondary"
          href={plan ? `/signup?plan=${encodeURIComponent(plan)}` : "/signup"}
        >
          Tentar novamente
        </a>
      </div>
    );
  return (
    <form action={action} className="yas-stack">
      {state.status === "unavailable" && (
        <Alert
          tone="error"
          title="Não foi possível continuar"
          description="Tente novamente em alguns instantes."
        />
      )}
      {retrying ? (
        <Alert
          tone="error"
          title="Seu cadastro ainda não foi concluído"
          description="Tente novamente para preparar sua conta com segurança."
        />
      ) : (
        <>
          {plan && <input type="hidden" name="plan" value={plan} />}
          {state.errors?.plan && (
            <Alert
              tone="error"
              title="Escolha um plano disponível"
              description="Volte aos planos para continuar."
            />
          )}
          <Input
            label="Nome"
            name="name"
            autoComplete="name"
            required
            minLength={2}
            maxLength={80}
            {...(state.errors?.name ? { tone: "error", message: state.errors.name[0] } : {})}
          />
          <Input
            label="E-mail"
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            {...(state.errors?.email ? { tone: "error", message: state.errors.email[0] } : {})}
          />
          <Input
            label="Senha"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={128}
            tone={state.errors?.password ? "error" : "default"}
            message={state.errors?.password?.[0] ?? "Use pelo menos 12 caracteres."}
          />
          <Input
            label="Confirmar senha"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={128}
            {...(state.errors?.confirmPassword
              ? { tone: "error", message: state.errors.confirmPassword[0] }
              : {})}
          />
        </>
      )}
      <Button type="submit" loading={pending}>
        {retrying ? "Tentar novamente" : "Criar minha conta"}
      </Button>
    </form>
  );
}
