"use server";

import { revalidatePath } from "next/cache";

import { materialFavoriteInputSchema } from "@/modules/materials";
import { setCurrentStudentMaterialFavorite } from "@/server/materials/materials";

export async function setMaterialFavoriteAction(formData: FormData): Promise<void> {
  const input = materialFavoriteInputSchema.parse({
    materialId: formData.get("materialId"),
    favorited: formData.get("favorited") === "true",
  });

  await setCurrentStudentMaterialFavorite(input);
  revalidatePath("/materiais");
}
