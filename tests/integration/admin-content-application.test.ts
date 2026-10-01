import { describe, expect, it, vi } from "vitest";

import {
  adminContentFormToPayload,
  listAdminContent,
  reorderAdminContent,
  saveAdminContent,
  transitionAdminContent,
  type AdminContentRecord,
  type AdminContentRepository,
} from "@/modules/admin-content";

const courseId = "89400000-0000-4000-8000-000000000011";
const moduleId = "89400000-0000-4000-8000-000000000012";
const lessonId = "89400000-0000-4000-8000-000000000013";
const assetIds = ["89400000-0000-4000-8000-000000000014", "89400000-0000-4000-8000-000000000015"];

function makeAsset(id: string, position: number): AdminContentRecord {
  return {
    id,
    kind: "lesson_assets",
    lesson_id: lessonId,
    position,
    asset_type: "TEXT",
    source_url: null,
    content: { text: `Lesson text ${position}` },
    metadata: {},
    publication_status: position === 1 ? "PUBLISHED" : "DRAFT",
    published_at: null,
    has_storage_reference: false,
  };
}

class MemoryAdminContentRepository implements AdminContentRepository {
  readonly calls: string[] = [];
  readonly assets = [makeAsset(assetIds[0]!, 1), makeAsset(assetIds[1]!, 2)];

  async list(kind: AdminContentRecord["kind"]) {
    this.calls.push(`list:${kind}`);
    return kind === "lesson_assets" ? this.assets.map((asset) => ({ ...asset })) : [];
  }

  async save(kind: AdminContentRecord["kind"], id: string | null, data: Record<string, unknown>) {
    this.calls.push(`save:${kind}`);
    const targetId = id ?? "89400000-0000-4000-8000-000000000099";
    if (kind === "lesson_assets") {
      const current = this.assets.find((asset) => asset.id === targetId);
      if (current?.publication_status === "PUBLISHED") throw new Error("Unpublish before editing.");
      Object.assign(current ?? {}, data, { id: targetId });
    }
    return targetId;
  }

  async transition(kind: AdminContentRecord["kind"], id: string, status: "DRAFT" | "PUBLISHED") {
    this.calls.push(`transition:${kind}:${status}`);
    const current = this.assets.find((asset) => asset.id === id);
    if (!current) throw new Error("Unknown content.");
    current.publication_status = status;
  }

  async reorder(kind: AdminContentRecord["kind"], parentId: string, ids: string[]) {
    this.calls.push(`reorder:${kind}`);
    if (kind !== "lesson_assets" || parentId !== lessonId) throw new Error("Wrong parent.");
    ids.forEach((id, index) => {
      const item = this.assets.find((asset) => asset.id === id);
      if (!item) throw new Error("Unknown content.");
      item.position = index + 1;
    });
  }
}

describe("Admin Content application boundary", () => {
  it("maps accessible form fields into the exact six RPC payload shapes", () => {
    const form = (values: Record<string, string>) => {
      const data = new FormData();
      for (const [key, value] of Object.entries(values)) data.set(key, value);
      return data;
    };

    expect(
      adminContentFormToPayload(
        "courses",
        form({ slug: "english-a1", title: "English A1", description: "Course", active: "true" }),
      ),
    ).toEqual({
      slug: "english-a1",
      title: "English A1",
      description: "Course",
      active: true,
    });
    expect(
      adminContentFormToPayload(
        "modules",
        form({ course_id: courseId, position: "2", title: "Unit 2", description: "Unit" }),
      ),
    ).toEqual({
      course_id: courseId,
      position: "2",
      title: "Unit 2",
      description: "Unit",
    });
    expect(
      adminContentFormToPayload(
        "lessons",
        form({
          module_id: moduleId,
          position: "1",
          slug: "lesson-one",
          title: "Lesson one",
          estimated_minutes: "10",
        }),
      ),
    ).toEqual({
      module_id: moduleId,
      position: "1",
      slug: "lesson-one",
      title: "Lesson one",
      estimated_minutes: "10",
    });
    expect(
      adminContentFormToPayload(
        "lesson_assets",
        form({
          lesson_id: lessonId,
          asset_type: "TEXT",
          position: "1",
          source_url: "",
          content_json: '{"title":"Hi","body":"Hello"}',
          metadata_json: "{}",
          required_entitlement_key: "",
        }),
      ),
    ).toEqual({
      lesson_id: lessonId,
      asset_type: "TEXT",
      position: "1",
      source_url: null,
      content: { title: "Hi", body: "Hello" },
      metadata: {},
      required_entitlement_key: null,
    });
    expect(
      adminContentFormToPayload(
        "materials",
        form({
          title: "Summary",
          material_type: "SUMMARY",
          module_id: "",
          lesson_id: lessonId,
          external_url: "https://example.test/summary",
          metadata_json: "{}",
          active: "true",
          required_entitlement_key: "",
        }),
      ),
    ).toEqual({
      title: "Summary",
      material_type: "SUMMARY",
      module_id: null,
      lesson_id: lessonId,
      external_url: "https://example.test/summary",
      metadata: {},
      active: true,
      required_entitlement_key: null,
    });
    expect(
      adminContentFormToPayload(
        "practice_activities",
        form({
          slug: "manual-speaking",
          title: "Speak",
          skill: "SPEAKING",
          cefr_target: "",
          difficulty: "",
          estimated_minutes: "5",
          related_module_id: "",
          related_lesson_id: "",
          content_json:
            '{"kind":"MANUAL_TEXT","evaluationMode":"MANUAL_PENDING","prompt":"Speak about your day","instructions":"Write a short response"}',
          answer_key_json: "",
          active: "true",
        }),
      ),
    ).toEqual({
      slug: "manual-speaking",
      title: "Speak",
      skill: "SPEAKING",
      cefr_target: null,
      difficulty: null,
      estimated_minutes: "5",
      related_module_id: null,
      related_lesson_id: null,
      content: {
        kind: "MANUAL_TEXT",
        evaluationMode: "MANUAL_PENDING",
        prompt: "Speak about your day",
        instructions: "Write a short response",
      },
      answer_key: null,
      active: true,
    });
  });

  it("lists the records supplied by the authorized repository including publication state", async () => {
    const repo = new MemoryAdminContentRepository();
    await expect(listAdminContent(repo, "lesson_assets")).resolves.toMatchObject([
      { id: assetIds[0], publication_status: "PUBLISHED" },
      { id: assetIds[1], publication_status: "DRAFT" },
    ]);
  });

  it("keeps draft save, explicit publish/unpublish, and atomic sibling ordering as separate commands", async () => {
    const repo = new MemoryAdminContentRepository();
    const savedId = await saveAdminContent(repo, {
      kind: "lesson_assets",
      id: assetIds[1]!,
      data: {
        lesson_id: lessonId,
        asset_type: "TEXT",
        position: "2",
        source_url: null,
        content: { text: "Edited draft" },
        metadata: {},
      },
    });
    expect(savedId).toBe(assetIds[1]);
    await transitionAdminContent(repo, {
      kind: "lesson_assets",
      id: assetIds[1]!,
      status: "PUBLISHED",
    });
    await expect(
      saveAdminContent(repo, {
        kind: "lesson_assets",
        id: assetIds[1]!,
        data: {
          lesson_id: lessonId,
          asset_type: "TEXT",
          position: "2",
          source_url: null,
          content: { text: "Blocked edit" },
          metadata: {},
        },
      }),
    ).rejects.toThrow("Unpublish before editing.");
    await transitionAdminContent(repo, {
      kind: "lesson_assets",
      id: assetIds[1]!,
      status: "DRAFT",
    });
    await reorderAdminContent(repo, {
      kind: "lesson_assets",
      parentId: lessonId,
      ids: [assetIds[1]!, assetIds[0]!],
    });

    expect(repo.assets.find((asset) => asset.id === assetIds[1])?.publication_status).toBe("DRAFT");
    expect(repo.assets.map((asset) => asset.position)).toEqual([2, 1]);
    expect(repo.calls).toEqual([
      "save:lesson_assets",
      "transition:lesson_assets:PUBLISHED",
      "save:lesson_assets",
      "transition:lesson_assets:DRAFT",
      "list:lesson_assets",
      "reorder:lesson_assets",
    ]);
  });

  it("does not call a repository command with malformed identity input", async () => {
    const repo = new MemoryAdminContentRepository();
    const saveSpy = vi.spyOn(repo, "save");
    await expect(
      saveAdminContent(repo, { kind: "courses", id: "not-a-uuid", data: {} }),
    ).rejects.toThrow();
    expect(saveSpy).not.toHaveBeenCalled();
  });
});
