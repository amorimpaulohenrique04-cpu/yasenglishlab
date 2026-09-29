import { z } from "zod";

import { entitlementKeySchema } from "./contracts";

export const entitlementBalanceSchema = z
  .object({
    key: entitlementKeySchema,
    limit: z.number().nonnegative().nullable(),
    used: z.number().nonnegative(),
    periodStart: z.string().datetime({ offset: true }).nullable(),
    periodEnd: z.string().datetime({ offset: true }).nullable(),
  })
  .strict();

export type EntitlementBalance = z.infer<typeof entitlementBalanceSchema>;

export function hasEntitlementAccess(
  balance: EntitlementBalance | null | undefined,
  units = 1,
): boolean {
  if (!balance || units <= 0) return false;
  if (balance.limit === null) return true;
  return balance.used + units <= balance.limit;
}
