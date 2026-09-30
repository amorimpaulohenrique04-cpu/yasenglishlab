import { z } from "zod";

import type { MaterialListItem } from "../domain/models";
import type { MaterialsAnalyticsPort, MaterialsRepository } from "./ports";

export const materialFavoriteInputSchema = z
  .object({
    materialId: z.string().uuid(),
    favorited: z.boolean(),
  })
  .strict();

export type MaterialFavoriteInput = z.infer<typeof materialFavoriteInputSchema>;

export async function setMaterialFavorite(
  repository: MaterialsRepository,
  analytics: MaterialsAnalyticsPort,
  userId: string,
  rawInput: MaterialFavoriteInput,
) {
  const input = materialFavoriteInputSchema.parse(rawInput);
  const result = await repository.setFavorite(userId, input.materialId, input.favorited);

  if (input.favorited && result.changed) {
    await analytics.track({
      event: "material_favorited",
      properties: { material_id: input.materialId },
    });
  }

  return result;
}

export async function trackMaterialOpened(
  analytics: MaterialsAnalyticsPort,
  material: MaterialListItem,
): Promise<void> {
  await analytics.track({
    event: "material_opened",
    properties: {
      material_id: material.id,
      material_type: material.materialType,
    },
  });
}
