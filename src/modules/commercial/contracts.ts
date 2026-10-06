import { z } from "zod";

export const planCodeSchema = z.string().regex(/^[A-Z][A-Z0-9_]{1,31}$/);
export const signupSchema = z
  .object({
    name: z.string().trim().min(2, "Informe seu nome.").max(80),
    email: z.email("Informe um e-mail válido.").trim().max(254),
    password: z.string().min(12, "Use pelo menos 12 caracteres.").max(128),
    confirmPassword: z.string().max(128),
    plan: planCodeSchema.optional(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "As senhas precisam ser iguais.",
  });

export type PublicPlan = Readonly<{
  code: string;
  name: string;
  description: string;
  amountCents: number;
  currency: "BRL";
  billingInterval: "MONTH";
  benefits: readonly string[];
}>;

export function checkoutPath(plan?: string) {
  return plan ? `/checkout?plan=${encodeURIComponent(planCodeSchema.parse(plan))}` : "/checkout";
}
export function loginPath(next: string) {
  return `/login?next=${encodeURIComponent(next)}`;
}
export function price(plan: PublicPlan) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: plan.currency }).format(
    plan.amountCents / 100,
  );
}
export function commercialDestination(placement: string | null) {
  return placement === "ENROLLED" ? "/home" : placement ? "/onboarding" : null;
}
export function paymentState(
  status: string,
  subscription: string | null,
  placement: string | null,
) {
  if (status === "PAID" && subscription === "ACTIVE") {
    const destination = commercialDestination(placement);
    return destination
      ? { kind: "confirmed" as const, destination }
      : { kind: "processing" as const };
  }
  if (["EXPIRED", "CANCELLED"].includes(status)) return { kind: "failed" as const };
  return { kind: "processing" as const };
}
