import { z } from "zod";

export const crmStages = ["NEW", "CONTACTED", "QUALIFIED", "WON", "LOST"] as const;
export const crmTemperature = ["COLD", "WARM", "HOT"] as const;
export const crmStageSchema = z.enum(crmStages);
export const crmLeadCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    email: z.union([z.literal(""), z.email().max(254)]).optional(),
    phone: z.union([z.literal(""), z.string().trim().min(7).max(32)]).optional(),
    source: z.string().trim().min(1).max(80),
    temperature: z.enum(crmTemperature).default("COLD"),
    estimated_value: z.union([z.literal(""), z.coerce.number().finite().nonnegative()]).optional(),
  })
  .refine((value) => Boolean(value.email || value.phone), {
    message: "Email ou telefone é obrigatório.",
  });

export function canMoveCrmStage(from: string, to: string) {
  return (
    (from === "NEW" && ["CONTACTED", "LOST"].includes(to)) ||
    (from === "CONTACTED" && ["QUALIFIED", "LOST"].includes(to)) ||
    (from === "QUALIFIED" && ["WON", "LOST"].includes(to))
  );
}

export function nextCrmStages(from: string) {
  return crmStages.filter((to) => canMoveCrmStage(from, to));
}
