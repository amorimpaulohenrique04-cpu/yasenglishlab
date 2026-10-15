import { describe, it, expect } from "vitest";
import {
  planCatalogSchema,
  entitlementChangeSchema,
  entitlementTimeline,
  localEntitlementDate,
  type PlanCatalog,
} from "@/modules/admin-plans/domain/models";
import {
  alertKinds,
  operationalAlertsSchema,
} from "@/modules/admin-overview/domain/operational-alerts";
const id = "dd120000-0000-4000-8000-000000000001";
describe("scheduled plan rights", () => {
  it("strictly rejects price, authority, fractional and negative rights", () => {
    const base = {
      planId: id,
      entitlementId: id,
      limitValue: 2,
      cadence: "WEEK",
      effectiveFrom: "2026-11-01T03:00:00Z",
    };
    expect(entitlementChangeSchema.parse(base).limitValue).toBe(2);
    for (const patch of [
      { limitValue: -1 },
      { limitValue: 1.5 },
      { amount_cents: 1 },
      { userId: id },
      { cadence: "YEAR" },
      { effectiveFrom: "not-a-date" },
    ])
      expect(entitlementChangeSchema.safeParse({ ...base, ...patch }).success).toBe(false);
  });
  it("uses the Recife offset and rejects malformed local dates", () => {
    expect(localEntitlementDate("2026-11-01T18:30")).toBe("2026-11-01T21:30:00.000Z");
    for (const date of ["2026-02-30T18:00", "2026-11-01", "", "2026-11-01T18:30Z"])
      expect(() => localEntitlementDate(date)).toThrow();
  });
  it("switches versions at the exact boundary without treating future versions as current", () => {
    const catalog = {
      generatedAt: "2026-11-01T03:00:00Z",
      plans: [],
      entitlements: [],
      versions: [
        {
          id,
          planId: id,
          entitlementId: id,
          limitValue: 1,
          cadence: "WEEK",
          effectiveFrom: "2026-01-01T00:00:00Z",
          effectiveTo: "2026-11-01T03:00:00Z",
        },
        {
          id,
          planId: id,
          entitlementId: id,
          limitValue: 2,
          cadence: "MONTH",
          effectiveFrom: "2026-11-01T03:00:00Z",
          effectiveTo: "2026-12-01T03:00:00Z",
        },
        {
          id,
          planId: id,
          entitlementId: id,
          limitValue: 0,
          cadence: "WEEK",
          effectiveFrom: "2026-12-01T03:00:00Z",
          effectiveTo: null,
        },
      ],
    } satisfies PlanCatalog;
    const timeline = entitlementTimeline(catalog, id, id);
    expect(timeline.current?.limitValue).toBe(2);
    expect(timeline.scheduled).toHaveLength(1);
    expect(timeline.latest?.limitValue).toBe(0);
    expect(entitlementTimeline(catalog, id, "different").current).toBeUndefined();
  });
});
describe("operational alert read model", () => {
  const model = {
    generatedAt: "2026-11-01T00:00:00Z",
    alerts: alertKinds.map((kind) => ({ kind, count: 0, items: [] })),
  };
  it("accepts a complete empty result distinctly from unavailability", () => {
    expect(operationalAlertsSchema.parse(model).alerts).toHaveLength(6);
    expect(operationalAlertsSchema.safeParse(null).success).toBe(false);
  });
  it("rejects duplicate categories, unbounded details and unknown operational causes", () => {
    expect(
      operationalAlertsSchema.safeParse({
        ...model,
        alerts: model.alerts.map(() => model.alerts[0]),
      }).success,
    ).toBe(false);
    for (const items of [
      Array.from({ length: 11 }, () => ({
        id,
        label: "Aluno",
        reason: "NO_CAPACITY",
        since: model.generatedAt,
      })),
      [{ id, label: "Aluno", reason: "UNKNOWN", since: model.generatedAt }],
    ])
      expect(
        operationalAlertsSchema.safeParse({
          ...model,
          alerts: [{ kind: "PLACEMENT_NO_COHORT", count: 11, items }, ...model.alerts.slice(1)],
        }).success,
      ).toBe(false);
  });
});

describe("canonical legacy UUID contracts", () => {
  it("reads and schedules seeded plan/entitlement IDs accepted by Postgres", () => {
    const planId = "10000000-0000-0000-0000-000000000001",
      entitlementId = "20000000-0000-0000-0000-000000000001";
    expect(
      planCatalogSchema.safeParse({
        generatedAt: "2026-10-15T18:26:24.10365+00:00",
        plans: [{ id: planId, code: "START", name: "Start", active: true }],
        entitlements: [
          {
            id: entitlementId,
            key: "weekly_core_classes",
            description: "Core",
            unit: "COUNT",
            active: true,
          },
        ],
        versions: [],
      }).success,
    ).toBe(true);
    expect(
      entitlementChangeSchema.safeParse({
        planId,
        entitlementId,
        limitValue: 1,
        cadence: "WEEK",
        effectiveFrom: "2026-11-01T00:00:00Z",
      }).success,
    ).toBe(true);
  });
  it("reads operational items containing canonical legacy cohort IDs", () => {
    const generatedAt = "2026-11-01T00:00:00Z";
    expect(
      operationalAlertsSchema.safeParse({
        generatedAt,
        alerts: alertKinds.map((kind, index) => ({
          kind,
          count: index ? 0 : 1,
          items: index
            ? []
            : [
                {
                  id: "50000000-0000-0000-0000-000000000001",
                  label: "Turma",
                  reason: "MISSING_SETTINGS",
                  since: generatedAt,
                },
              ],
        })),
      }).success,
    ).toBe(true);
  });
});
