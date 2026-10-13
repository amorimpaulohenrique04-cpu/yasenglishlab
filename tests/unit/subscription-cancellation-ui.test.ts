import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StudentSubscription } from "@/modules/billing/ui/student-subscription";
import {
  cancelErrorMessages,
  confirmationDescription,
  scheduledDescription,
  scheduledTitle,
} from "@/modules/billing/ui/cancellation-copy";

type Props = Parameters<typeof StudentSubscription>[0];
const base = {
  planName: "Plano Pro",
  status: "ACTIVE",
  amountCents: 19900,
  periodStart: "2026-10-01T12:00:00.000Z",
  periodEnd: "2026-11-01T12:00:00.000Z",
  startedAt: "2026-09-01T12:00:00.000Z",
  endedAt: null,
  cancelAtPeriodEnd: false,
  accessUntil: null,
  cancellationState: null,
  benefits: [],
} as unknown as NonNullable<Props["subscription"]>;
const action = async () => ({
  kind: "cancel_requested" as const,
  accessUntil: null,
  alreadyRequested: false,
});
const render = (subscription: Props["subscription"], withAction = true) =>
  renderToStaticMarkup(
    createElement(StudentSubscription, {
      subscription,
      ...(withAction ? { cancelAction: action } : {}),
    }),
  );

describe("subscription cancellation UI", () => {
  it("active subscription offers cancel with accessible confirmation", () => {
    const html = render(base);
    expect(html).toContain("Cancelar assinatura");
    expect(html).toContain("Manter assinatura");
    expect(html).toContain("Sim, cancelar assinatura");
    expect(html).toContain("até o fim do período já pago");
    expect(html).toContain("não serão apagados");
    expect(html).not.toContain("Cancelamento agendado");
  });

  it("no cancel button without action or for non-active subscriptions", () => {
    expect(render(base, false)).not.toContain("Cancelar assinatura");
    expect(render({ ...base, status: "PAST_DUE" } as typeof base)).not.toContain(
      "Cancelar assinatura",
    );
  });

  it("scheduled shows date, no cancel button, no undo", () => {
    const html = render({
      ...base,
      cancelAtPeriodEnd: true,
      accessUntil: "2026-11-01T12:00:00.000Z",
      cancellationState: "CANCEL_SCHEDULED",
    } as typeof base);
    expect(html).toContain("Cancelamento agendado — acesso até 01/11/2026");
    expect(html).not.toContain("Cancelar assinatura");
    expect(html).not.toMatch(/desfazer|reativar/i);
  });

  it("cancelled with access shows date and no checkout CTA", () => {
    const html = render({
      ...base,
      status: "CANCELLED",
      accessUntil: "2026-11-01T12:00:00.000Z",
      cancellationState: "CANCELLED_WITH_ACCESS",
    } as typeof base);
    expect(html).toContain("Cancelamento agendado — acesso até 01/11/2026");
    expect(html).not.toContain("/checkout");
    expect(html).not.toContain("Cancelar assinatura");
  });

  it("copy covers every error code, with known and unknown dates", () => {
    expect(Object.keys(cancelErrorMessages).sort()).toEqual([
      "ACTIVE_SUBSCRIPTION_REQUIRED",
      "FORBIDDEN",
      "PROVIDER_UNAVAILABLE",
      "UNAVAILABLE",
    ]);
    expect(cancelErrorMessages.PROVIDER_UNAVAILABLE.description).toContain("Nada foi cancelado");
    expect(confirmationDescription("2026-11-01T12:00:00.000Z")).toContain("até 01/11/2026");
    expect(scheduledTitle(null)).toContain("fim do período pago");
  });

  it("copy never mentions interest, fines or blame", () => {
    const all = [
      ...Object.values(cancelErrorMessages).flatMap((m) => [m.title, m.description]),
      confirmationDescription(null),
      scheduledTitle(null),
      scheduledDescription,
      render(base),
    ].join(" ");
    expect(all).not.toMatch(/juros|multa|culpa|sua falha|você errou/i);
  });
});
