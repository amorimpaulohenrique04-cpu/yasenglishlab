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

  it("PAST_DUE explains pending payment, offers no invented link and no checkout CTA", () => {
    const html = render(pastDue);
    expect(html).toContain("Pagamento pendente");
    expect(html).toContain("suporte");
    expect(html).toContain("Nada foi apagado");
    expect(html).not.toContain("<a ");
    expect(html).not.toContain("/checkout");
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
    for (const access of [pastDue, expired, cancelled]) {
      const copy = suspensionCopy(access);
      const text = `${copy.title} ${copy.description} ${copy.guidance}`.toLowerCase();
      expect(text).not.toMatch(/juros|multa|culpa|inadimpl/);
    }
  });

  it("omits the CTA when regularization is not allowed", () => {
    expect(suspensionCopy({ ...expired, canRegularize: false }).action).toBeNull();
  });
});
