import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SubscriptionSuspendedNotice } from "@/modules/billing/ui/suspension-notice";
import { suspensionCopy, type SuspendedAccess } from "@/modules/billing/ui/suspension-copy";

const pastDue: SuspendedAccess = {
  kind: "suspended",
  reason: "PAST_DUE",
  canRegularize: true,
  regularization: "PAY_PENDING",
};
const expired: SuspendedAccess = {
  kind: "suspended",
  reason: "EXPIRED",
  canRegularize: true,
  regularization: "NEW_CHECKOUT",
};
const cancelled: SuspendedAccess = { ...expired, reason: "CANCELLED" };

const render = (
  access: Parameters<typeof SubscriptionSuspendedNotice>[0]["access"],
  context?: "agenda",
) =>
  renderToStaticMarkup(
    createElement(SubscriptionSuspendedNotice, context ? { access, context } : { access }),
  );

describe("SubscriptionSuspendedNotice", () => {
  it("renders nothing when access is ok", () => {
    expect(render({ kind: "ok" })).toBe("");
  });

  // Etapa 11: the only link is the internal guidance-only /support page; no invented external channel.
  it("PAST_DUE explains pending payment, links only to the profile charge view and offers no checkout CTA", () => {
    const html = render(pastDue);
    expect(html).toContain("Pagamento pendente");
    expect(html).toContain("suporte");
    expect(html).toContain("Nada foi apagado");
    expect(html.match(/<a /g)).toHaveLength(1);
    expect(html).toContain('href="/profile"');
    expect(html).not.toMatch(/https?:|mailto:|wa\.me|tel:/);
    expect(html).not.toContain("/checkout");
  });

  it("NO_SUBSCRIPTION invites a first checkout without implying a lost subscription", () => {
    const html = render({ ...expired, reason: "NO_SUBSCRIPTION" });
    expect(html).toContain("Escolha um plano para começar");
    expect(html).toContain('href="/checkout"');
    expect(html).toContain('data-suspension="NO_SUBSCRIPTION"');
    expect(html).not.toContain("Nada foi apagado");
    expect(html).not.toContain("cancelada");
  });

  it.each([
    ["EXPIRED", expired, "Sua assinatura está encerrada"],
    ["CANCELLED", cancelled, "Sua assinatura foi cancelada"],
  ])("%s points to a new checkout", (_name, access, title) => {
    const html = render(access);
    expect(html).toContain(title);
    expect(html).toContain('href="/checkout"');
    expect(html).toContain("Reativar assinatura");
  });

  it("uses the context scope and role=status", () => {
    const html = render(pastDue, "agenda");
    expect(html).toContain('role="status"');
    expect(html).toContain("Novas reservas");
  });

  it("never mentions interest or blames the student", () => {
    for (const access of [
      pastDue,
      expired,
      cancelled,
      { ...expired, reason: "NO_SUBSCRIPTION" } as const,
    ]) {
      const copy = suspensionCopy(access);
      const text = `${copy.title} ${copy.description} ${copy.guidance}`.toLowerCase();
      expect(text).not.toMatch(/juros|multa|culpa|inadimpl/);
    }
  });

  it("omits the CTA when regularization is not allowed", () => {
    expect(suspensionCopy({ ...expired, canRegularize: false }).action).toBeNull();
  });
});
