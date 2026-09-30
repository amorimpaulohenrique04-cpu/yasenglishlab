import {
  filterMaterials,
  groupMaterialsByModule,
  normalizeMaterialsFilters,
  sortMaterials,
  type MaterialGroup,
  type MaterialListItem,
  type MaterialsFilters,
  type MaterialsState,
} from "../domain/models";
import type { MaterialsRepository } from "./ports";

export interface MaterialsView {
  filters: MaterialsFilters;
  materials: MaterialListItem[];
  groups: MaterialGroup[];
  favorites: MaterialListItem[];
  totalAuthorized: number;
}

export async function getMaterialsView(
  repository: MaterialsRepository,
  userId: string,
  isStudent: boolean,
  rawFilters: { query?: unknown; type?: unknown },
): Promise<MaterialsState<MaterialsView>> {
  if (!isStudent) return { status: "unauthorized" };

  const authorized = sortMaterials(await repository.listAuthorizedMaterials(userId));
  if (authorized.length === 0) return { status: "empty" };

  const filters = normalizeMaterialsFilters(rawFilters);
  const materials = filterMaterials(authorized, filters);

  return {
    status: "success",
    data: {
      filters,
      materials,
      groups: groupMaterialsByModule(materials),
      favorites: authorized.filter((material) => material.favorite),
      totalAuthorized: authorized.length,
    },
  };
}
