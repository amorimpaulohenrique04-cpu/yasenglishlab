import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import {
  explainEventError,
  NotificationFailuresTable,
  OperationsPagination,
  RejectedEventsTable,
  StuckCheckoutsTable,
  operationsDate,
} from "@/modules/billing/ui/admin-operations";

const id = "10000000-0000-0000-0000-000000000001";

describe("Admin billing operations UI", () => {
  it("shows a friendly empty state", () => {
    for (const table of [RejectedEventsTable, StuckCheckoutsTable, NotificationFailuresTable]) {
      const html = renderToStaticMarkup(createElement(table, { rows: [] }));
      expect(html).toContain("Nenhum item — tudo em ordem");
      expect(html).not.toContain("<table");
    }
  });

  it("renders accessible event rows with explanations", () => {
    const html = renderToStaticMarkup(
      createElement(RejectedEventsTable, {
        rows: [
          {
            id,
            outcome: "REJECTED",
            event_type: "payment.confirmed",
            processing_error: "AMOUNT_MISMATCH",
            occurred_at: "2026-10-01T15:00:00Z",
            processed_at: null,
            subscription_id: null,
          },
        ],
      }),
    );
    expect(html).toContain('scope="col"');
    expect(html).toContain("<caption>");
    expect(html).toContain("AMOUNT_MISMATCH");
    expect(html).toContain("não confere com o valor");
    expect(html).toContain("Rejeitado");
    expect(html).toContain("01/10/2026");
  });

  it("explains known and unknown errors", () => {
    expect(explainEventError("CHECKOUT_NOT_FOUND")).toMatch(/checkout/);
    expect(explainEventError("WHATEVER")).toMatch(/não catalogado/);
    expect(explainEventError("constructor")).toMatch(/não catalogado/);
    expect(explainEventError(null)).toMatch(/Sem motivo/);
  });

  it("renders stuck checkouts and notification failures", () => {
    const stuck = renderToStaticMarkup(
      createElement(StuckCheckoutsTable, {
        rows: [
          {
            id,
            status: "READY",
            stuck_reason: "READY_PAST_EXPIRY",
            plan_code: "TALK",
            user_id: id,
            display_name: null,
            has_subscription: true,
            created_at: "2026-10-01T15:00:00Z",
            expires_at: "2026-10-02T15:00:00Z",
          },
        ],
      }),
    );
    expect(stuck).toContain("expirou sem pagamento confirmado");
    expect(stuck).toContain("Aluno indisponível");
    const mail = renderToStaticMarkup(
      createElement(NotificationFailuresTable, {
        rows: [
          {
            id,
            status: "PENDING",
            notification_type: "BILLING_NOTICE",
            attempt_count: 2,
            last_error_code: null,
            next_attempt_at: null,
            created_at: "2026-10-01T15:00:00Z",
            updated_at: null,
          },
        ],
      }),
    );
    expect(mail).toContain("Atrasado");
    expect(mail).toContain("BILLING_NOTICE");
  });

  it("formats dates in America/Recife and tolerates bad values", () => {
    expect(operationsDate("2026-10-01T02:30:00Z")).toContain("30/09/2026");
    expect(operationsDate(null)).toBe("—");
    expect(operationsDate("nope")).toBe("—");
  });

  it("paginates with previous/next only when applicable", () => {
    const href = (p: number) => `/x?p=${p}`;
    const middle = renderToStaticMarkup(
      createElement(OperationsPagination, { label: "Pag", page: 2, hasNext: true, hrefFor: href }),
    );
    expect(middle).toContain("Página anterior");
    expect(middle).toContain("Próxima página");
    expect(middle).toContain("/x?p=3");
    const first = renderToStaticMarkup(
      createElement(OperationsPagination, { label: "Pag", page: 1, hasNext: false, hrefFor: href }),
    );
    expect(first).not.toContain("Página anterior");
    expect(first).not.toContain("Próxima página");
  });
});
