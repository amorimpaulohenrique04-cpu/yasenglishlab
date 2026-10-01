import type { AdminContentKind } from "../domain/models";

function one(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function nullable(value: string): string | null {
  return value || null;
}

function parseJson(value: string): unknown {
  if (!value.trim()) return null;
  return JSON.parse(value) as unknown;
}

export function adminContentFormToPayload(
  kind: AdminContentKind,
  formData: FormData,
): Record<string, unknown> {
  switch (kind) {
    case "courses":
      return {
        slug: one(formData, "slug"),
        title: one(formData, "title"),
        description: nullable(one(formData, "description")),
        active: one(formData, "active") === "true",
      };
    case "modules":
      return {
        course_id: one(formData, "course_id"),
        position: one(formData, "position"),
        title: one(formData, "title"),
        description: nullable(one(formData, "description")),
      };
    case "lessons":
      return {
        module_id: one(formData, "module_id"),
        position: one(formData, "position"),
        slug: one(formData, "slug"),
        title: one(formData, "title"),
        estimated_minutes: one(formData, "estimated_minutes"),
      };
    case "lesson_assets":
      return {
        lesson_id: one(formData, "lesson_id"),
        asset_type: one(formData, "asset_type"),
        position: one(formData, "position"),
        source_url: nullable(one(formData, "source_url")),
        content: parseJson(one(formData, "content_json")),
        metadata: parseJson(one(formData, "metadata_json")) ?? {},
        required_entitlement_key: nullable(one(formData, "required_entitlement_key")),
      };
    case "materials":
      return {
        title: one(formData, "title"),
        material_type: one(formData, "material_type"),
        module_id: nullable(one(formData, "module_id")),
        lesson_id: nullable(one(formData, "lesson_id")),
        external_url: nullable(one(formData, "external_url")),
        metadata: parseJson(one(formData, "metadata_json")) ?? {},
        active: one(formData, "active") === "true",
        required_entitlement_key: nullable(one(formData, "required_entitlement_key")),
      };
    case "practice_activities":
      return {
        slug: one(formData, "slug"),
        title: one(formData, "title"),
        skill: one(formData, "skill"),
        cefr_target: nullable(one(formData, "cefr_target")),
        difficulty: nullable(one(formData, "difficulty")),
        estimated_minutes: one(formData, "estimated_minutes"),
        related_module_id: nullable(one(formData, "related_module_id")),
        related_lesson_id: nullable(one(formData, "related_lesson_id")),
        content: parseJson(one(formData, "content_json")),
        answer_key: parseJson(one(formData, "answer_key_json")),
        active: one(formData, "active") === "true",
      };
  }
}
