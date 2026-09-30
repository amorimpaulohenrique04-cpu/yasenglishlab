import type { MaterialListItem } from "../domain/models";

export interface MaterialFavoriteResult {
  favorited: boolean;
  changed: boolean;
}

export interface MaterialsRepository {
  listAuthorizedMaterials(userId: string): Promise<MaterialListItem[]>;
  getAuthorizedMaterial(userId: string, materialId: string): Promise<MaterialListItem | null>;
  setFavorite(
    userId: string,
    materialId: string,
    favorited: boolean,
  ): Promise<MaterialFavoriteResult>;
}

export interface MaterialsAnalyticsPort {
  track(input: {
    event: "material_opened" | "material_favorited";
    properties: Record<string, unknown>;
  }): Promise<void>;
}
