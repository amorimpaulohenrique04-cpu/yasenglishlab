import { z } from "zod";
export const cadenceSchema = z.enum(["WEEK", "MONTH", "NONE"]);
export const entitlementChangeSchema = z
  .object({
    planId: z.guid(),
    entitlementId: z.guid(),
    limitValue: z.number().int().min(0).max(99999999),
    cadence: cadenceSchema,
    effectiveFrom: z.iso.datetime({ offset: true }),
  })
  .strict();
export const planCatalogSchema = z.object({
  generatedAt: z.iso.datetime({ offset: true }),
  plans: z.array(
    z.object({ id: z.guid(), code: z.string(), name: z.string(), active: z.boolean() }),
  ),
  entitlements: z.array(
    z.object({
      id: z.guid(),
      key: z.string(),
      description: z.string(),
      unit: z.enum(["COUNT", "BOOLEAN"]),
      active: z.boolean(),
    }),
  ),
  versions: z.array(
    z.object({
      id: z.guid(),
      planId: z.guid(),
      entitlementId: z.guid(),
      limitValue: z.number(),
      cadence: cadenceSchema,
      effectiveFrom: z.iso.datetime({ offset: true }),
      effectiveTo: z.iso.datetime({ offset: true }).nullable(),
    }),
  ),
});
export type PlanCatalog = z.infer<typeof planCatalogSchema>;
export type EntitlementChange = z.infer<typeof entitlementChangeSchema>;
export type PlanFormState = { error?: string; success?: string };
export const cadenceLabels = {
  WEEK: "Por semana",
  MONTH: "Por mês",
  NONE: "Sem recorrência",
} as const;
export function entitlementTimeline(catalog: PlanCatalog, planId: string, entitlementId: string) {
  const now = Date.parse(catalog.generatedAt);
  const versions = catalog.versions
    .filter((v) => v.planId === planId && v.entitlementId === entitlementId)
    .sort((a, b) => Date.parse(a.effectiveFrom) - Date.parse(b.effectiveFrom));
  return {
    current: versions.find(
      (v) =>
        Date.parse(v.effectiveFrom) <= now && (!v.effectiveTo || Date.parse(v.effectiveTo) > now),
    ),
    scheduled: versions.filter((v) => Date.parse(v.effectiveFrom) > now),
    latest: versions.at(-1),
  };
}
export function localEntitlementDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error("Informe data e hora.");
  const iso = z.iso.datetime({ offset: true }).parse(value + ":00-03:00");
  return new Date(iso).toISOString();
}
