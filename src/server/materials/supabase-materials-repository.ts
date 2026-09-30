import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  MATERIAL_TYPES,
  type MaterialLessonContext,
  type MaterialListItem,
  type MaterialModuleContext,
  type MaterialsRepository,
  type MaterialType,
} from "@/modules/materials";

function metadataFromRow(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function materialTypeFromRow(value: unknown): MaterialType {
  if (typeof value === "string" && MATERIAL_TYPES.includes(value as MaterialType)) {
    return value as MaterialType;
  }
  throw new Error("Material type is invalid.");
}

export class SupabaseMaterialsRepository implements MaterialsRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listAuthorizedMaterials(userId: string): Promise<MaterialListItem[]> {
    const [
      { data: materialRows, error: materialError },
      { data: favoriteRows, error: favoriteError },
    ] = await Promise.all([
      this.client
        .from("materials")
        .select("id, title, material_type, module_id, lesson_id, metadata")
        .eq("active", true)
        .order("created_at")
        .order("id"),
      this.client
        .from("material_favorites")
        .select("material_id")
        .eq("user_id", userId)
        .order("created_at"),
    ]);

    if (materialError) throw new Error("Unable to load materials.");
    if (favoriteError) throw new Error("Unable to load material favorites.");

    const rows = materialRows ?? [];
    const lessonIds = [
      ...new Set(
        rows
          .map((row) => row.lesson_id)
          .filter((value): value is string => typeof value === "string"),
      ),
    ];

    const lessonResult =
      lessonIds.length === 0
        ? { data: [], error: null }
        : await this.client
            .from("lessons")
            .select("id, module_id, position, title")
            .in("id", lessonIds)
            .order("position")
            .order("id");

    if (lessonResult.error) throw new Error("Unable to load material lesson context.");

    const lessonsById = new Map<string, MaterialLessonContext & { moduleId: string }>();
    for (const row of lessonResult.data ?? []) {
      lessonsById.set(String(row.id), {
        id: String(row.id),
        moduleId: String(row.module_id),
        position: Number(row.position),
        title: String(row.title),
      });
    }

    const moduleIds = [
      ...new Set([
        ...rows
          .map((row) => row.module_id)
          .filter((value): value is string => typeof value === "string"),
        ...[...lessonsById.values()].map((lesson) => lesson.moduleId),
      ]),
    ];

    const moduleResult =
      moduleIds.length === 0
        ? { data: [], error: null }
        : await this.client
            .from("modules")
            .select("id, position, title")
            .in("id", moduleIds)
            .order("position")
            .order("id");

    if (moduleResult.error) throw new Error("Unable to load material module context.");

    const modulesById = new Map<string, MaterialModuleContext>(
      (moduleResult.data ?? []).map((row) => [
        String(row.id),
        {
          id: String(row.id),
          position: Number(row.position),
          title: String(row.title),
        },
      ]),
    );

    const favorites = new Set((favoriteRows ?? []).map((row) => String(row.material_id)));

    return rows.map((row) => {
      const lessonWithModule =
        typeof row.lesson_id === "string" ? lessonsById.get(row.lesson_id) ?? null : null;
      const directModuleId = typeof row.module_id === "string" ? row.module_id : null;
      const module = directModuleId
        ? modulesById.get(directModuleId) ?? null
        : lessonWithModule
          ? modulesById.get(lessonWithModule.moduleId) ?? null
          : null;
      const lesson: MaterialLessonContext | null = lessonWithModule
        ? {
            id: lessonWithModule.id,
            position: lessonWithModule.position,
            title: lessonWithModule.title,
          }
        : null;

      return {
        id: String(row.id),
        title: String(row.title),
        materialType: materialTypeFromRow(row.material_type),
        metadata: metadataFromRow(row.metadata),
        module,
        lesson,
        favorite: favorites.has(String(row.id)),
      };
    });
  }

  async getAuthorizedMaterial(userId: string, materialId: string): Promise<MaterialListItem | null> {
    const materials = await this.listAuthorizedMaterials(userId);
    return materials.find((material) => material.id === materialId) ?? null;
  }

  async setFavorite(
    userId: string,
    materialId: string,
    favorited: boolean,
  ): Promise<{ favorited: boolean; changed: boolean }> {
    if (favorited) {
      const { error } = await this.client.from("material_favorites").insert({
        user_id: userId,
        material_id: materialId,
      });

      if (error?.code === "23505") {
        return { favorited: true, changed: false };
      }
      if (error) throw new Error("Unable to favorite material.");
      return { favorited: true, changed: true };
    }

    const { data, error } = await this.client
      .from("material_favorites")
      .delete()
      .eq("user_id", userId)
      .eq("material_id", materialId)
      .select("id");

    if (error) throw new Error("Unable to unfavorite material.");

    return { favorited: false, changed: (data ?? []).length > 0 };
  }
}
