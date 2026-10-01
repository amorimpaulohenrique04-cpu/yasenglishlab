import { describe, expect, it, vi } from "vitest";

import {
  parseAdminContentSaveData,
  reorderAdminContent,
  saveAdminContent,
  transitionAdminContent,
  type AdminContentRecord,
  type AdminContentRepository,
} from "@/modules/admin-content";

const courseId = "89400000-0000-4000-8000-000000000001";
const lessonId = "89400000-0000-4000-8000-000000000003";
const firstAsset = "89400000-0000-4000-8000-000000000004";
const secondAsset = "89400000-0000-4000-8000-000000000005";

function record(id: string, parent: string, position: number): AdminContentRecord {
  return {
    id,
    kind: "lesson_assets",
    publication_status: "DRAFT",
    published_at: null,
    has_storage_reference: false,
    lesson_id: parent,
    position,
    asset_type: "TEXT",
    title: `Asset ${position}`,
  };
}

function repository(records: AdminContentRecord[] = []): AdminContentRepository {
  return {
    list: vi.fn(async () => records),
    save: vi.fn(async () => firstAsset),
    transition: vi.fn(async () => undefined),
    reorder: vi.fn(async () => undefined),
  };
}

describe("Admin Content validation and commands", () => {
  it("validates course slugs and excludes server-owned publication and identity fields", () => {
    expect(() =>
      parseAdminContentSaveData("courses", {
        slug: "Introdução",
        title: "Introdução",
        description: null,
        active: true,
      }),
    ).toThrow();

    expect(() =>
      parseAdminContentSaveData("courses", {
        slug: "introducao",
        title: "Introdução",
        description: null,
        active: true,
        publication_status: "PUBLISHED",
        id: courseId,
      }),
    ).toThrow();
  });

  it("allows only HTTP(S) source URLs", () => {
    expect(() =>
      parseAdminContentSaveData("materials", {
        title: "Unsafe link",
        material_type: "SUMMARY",
        module_id: null,
        lesson_id: null,
        external_url: "javascript:alert(1)",
        metadata: {},
        active: true,
      }),
    ).toThrow();
  });

  it("allows unfinished draft answer keys but validates any supplied private key against options", () => {
    const content = {
      kind: "MULTIPLE_CHOICE",
      evaluationMode: "DETERMINISTIC",
      prompt: "Choose the correct phrase.",
      options: [
        { id: "a", label: "Good morning" },
        { id: "b", label: "Good night" },
      ],
    };
    const activity = {
      slug: "greetings-1",
      title: "Greetings",
      skill: "VOCABULARY",
      cefr_target: "A1",
      difficulty: "Básico",
      estimated_minutes: 5,
      related_module_id: null,
      related_lesson_id: null,
      content,
      active: true,
    };
    expect(parseAdminContentSaveData("practice_activities", activity)).toMatchObject({ content });
    expect(
      parseAdminContentSaveData("practice_activities", {
        ...activity,
        answer_key: { optionId: "a" },
      }),
    ).toMatchObject({ content, answer_key: { optionId: "a" } });
    expect(() =>
      parseAdminContentSaveData("practice_activities", {
        ...activity,
        answer_key: { optionId: "missing" },
      }),
    ).toThrow();
    expect(() =>
      parseAdminContentSaveData("practice_activities", {
        ...activity,
        content: {
          kind: "MANUAL_TEXT",
          evaluationMode: "MANUAL_PENDING",
          prompt: "Speak",
          instructions: "Record an answer",
        },
        answer_key: { optionId: "a" },
      }),
    ).toThrow();
  });

  it("saves a whitelisted payload with explicit kind and leaves actor fields outside application data", async () => {
    const repo = repository();
    const id = await saveAdminContent(repo, {
      kind: "modules",
      id: null,
      data: { course_id: courseId, position: "1", title: "Unit 1", description: null },
    });

    expect(id).toBe(firstAsset);
    expect(repo.save).toHaveBeenCalledWith("modules", null, {
      course_id: courseId,
      position: 1,
      title: "Unit 1",
      description: null,
    });
  });

  it("only reorders an exact permutation from one parent and allows explicit publication transitions", async () => {
    const repo = repository([record(firstAsset, lessonId, 1), record(secondAsset, lessonId, 2)]);
    await reorderAdminContent(repo, {
      kind: "lesson_assets",
      parentId: lessonId,
      ids: [secondAsset, firstAsset],
    });
    expect(repo.reorder).toHaveBeenCalledWith("lesson_assets", lessonId, [secondAsset, firstAsset]);
    await expect(
      reorderAdminContent(repo, { kind: "lesson_assets", parentId: lessonId, ids: [firstAsset] }),
    ).rejects.toThrow();
    await expect(
      reorderAdminContent(repo, { kind: "materials", parentId: lessonId, ids: [firstAsset] }),
    ).rejects.toThrow();

    await transitionAdminContent(repo, { kind: "lesson_assets", id: firstAsset, status: "DRAFT" });
    expect(repo.transition).toHaveBeenCalledWith("lesson_assets", firstAsset, "DRAFT");
    await expect(
      transitionAdminContent(repo, {
        kind: "lesson_assets",
        id: firstAsset,
        status: "RETIRED" as never,
      }),
    ).rejects.toThrow();
  });
});
