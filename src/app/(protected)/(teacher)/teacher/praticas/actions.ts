"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { PRACTICE_SKILLS } from "@/modules/domain";
import { assertRole } from "@/server/auth/guards";
import { completePracticeAssetUpload, requestPracticeAssetUpload } from "@/server/practice/assets";
import {
  PracticeAuthoringError,
  assignTeacherPractice,
  duplicateTeacherPractice,
  publishTeacherPractice,
  saveTeacherPractice,
  unassignTeacherPractice,
  unpublishTeacherPractice,
} from "@/server/teacher-operations/practice-commands";

import { autosaveTeacherPractice } from "@/server/teacher-operations/practice-autosave";

const LIST = "/teacher/praticas";

function failure(target: string, error: unknown): never {
  const reason = error instanceof PracticeAuthoringError ? error.code : "UNAVAILABLE";
  redirect(`${target}?save=error&reason=${reason}`);
}

function refresh(id: string) {
  revalidatePath(LIST);
  revalidatePath(`${LIST}/${id}`);
  revalidatePath("/pratica");
  revalidatePath("/home");
}

/** `datetime-local` has no offset: it is interpreted as America/Sao_Paulo (UTC-03:00, no DST). */
function toDueAt(value: FormDataEntryValue | null): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return null;
  const withOffset = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(text) ? `${text}:00-03:00` : text;
  const date = new Date(withOffset);
  if (Number.isNaN(date.getTime())) throw new Error("Prazo inválido.");
  return date.toISOString();
}

function jsonField(form: FormData, name: string): unknown {
  const raw = form.get(name);
  if (typeof raw !== "string" || raw.trim() === "") return null;
  return JSON.parse(raw);
}

const optionalUuid = z.preprocess((v) => (v === "" || v == null ? null : v), z.uuid().nullable());

export async function savePracticeAction(form: FormData) {
  await assertRole("TEACHER");
  const id = optionalUuid.parse(form.get("id"));
  const target = id ? `${LIST}/${id}` : `${LIST}/nova`;
  let savedId: string;
  try {
    savedId = await saveTeacherPractice({
      id,
      title: form.get("title"),
      skill: z.enum(PRACTICE_SKILLS).parse(form.get("skill")),
      cefrTarget: form.get("cefrTarget") || null,
      difficulty: form.get("difficulty") || null,
      estimatedMinutes: Number(form.get("estimatedMinutes")),
      courseId: form.get("courseId"),
      relatedModuleId: form.get("relatedModuleId") || null,
      relatedLessonId: form.get("relatedLessonId") || null,
      content: jsonField(form, "content"),
      answerKey: jsonField(form, "answerKey"),
      feedback: jsonField(form, "feedback"),
      itemKeys: jsonField(form, "itemKeys"),
    });
  } catch (error) {
    failure(target, error);
  }
  refresh(savedId);
  redirect(`${LIST}/${savedId}?save=success`);
}

export async function publishPracticeAction(form: FormData) {
  await assertRole("TEACHER");
  const id = z.uuid().parse(form.get("id"));
  try {
    await publishTeacherPractice(id);
  } catch (error) {
    failure(`${LIST}/${id}`, error);
  }
  refresh(id);
  redirect(`${LIST}/${id}?save=success`);
}

export async function unpublishPracticeAction(form: FormData) {
  await assertRole("TEACHER");
  const id = z.uuid().parse(form.get("id"));
  try {
    await unpublishTeacherPractice(id);
  } catch (error) {
    failure(`${LIST}/${id}`, error);
  }
  refresh(id);
  redirect(`${LIST}/${id}?save=success`);
}

export async function duplicatePracticeAction(form: FormData) {
  await assertRole("TEACHER");
  const id = z.uuid().parse(form.get("id"));
  let copyId: string;
  try {
    copyId = await duplicateTeacherPractice(id);
  } catch (error) {
    failure(`${LIST}/${id}`, error);
  }
  refresh(copyId);
  redirect(`${LIST}/${copyId}?save=success`);
}

export async function assignPracticeAction(form: FormData) {
  await assertRole("TEACHER");
  const id = z.uuid().parse(form.get("id"));
  const cohortIds = z.array(z.uuid()).min(1).max(20).parse(form.getAll("cohortIds").map(String));
  try {
    await assignTeacherPractice({
      practiceId: id,
      cohortIds,
      dueAt: toDueAt(form.get("dueAt")),
      availableFrom: toDueAt(form.get("availableFrom")),
      requireLessonAvailable: form.get("requireLessonAvailable") === "on",
    });
  } catch (error) {
    failure(`${LIST}/${id}`, error);
  }
  refresh(id);
  redirect(`${LIST}/${id}?save=success`);
}

export async function unassignPracticeAction(form: FormData) {
  await assertRole("TEACHER");
  const id = z.uuid().parse(form.get("id"));
  const cohortId = z.uuid().parse(form.get("cohortId"));
  try {
    await unassignTeacherPractice(id, cohortId);
  } catch (error) {
    failure(`${LIST}/${id}`, error);
  }
  refresh(id);
  redirect(`${LIST}/${id}?save=success`);
}

/** Client-callable: returns a signed upload URL for a stimulus asset (no redirect). */
type AssetKind = "IMAGE" | "AUDIO" | "VIDEO";
export async function reservePracticeAssetAction(id: string, assetType: AssetKind, mime: string) {
  await assertRole("TEACHER");
  return requestPracticeAssetUpload({ practiceId: id, assetType, mime });
}

export async function completePracticeAssetAction(assetId: string, practiceId: string) {
  await assertRole("TEACHER");
  const result = await completePracticeAssetUpload(assetId);
  revalidatePath(`${LIST}/${z.uuid().parse(practiceId)}`);
  return result;
}

/** Nonredirecting autosave. The database owns revision checks and creation idempotency. */
export async function autosavePracticeAction(
  form: FormData,
  creationKey: string,
  expected: string | null,
) {
  await assertRole("TEACHER");
  try {
    const result = await autosaveTeacherPractice(
      {
        id: optionalUuid.parse(form.get("id")),
        title: form.get("title"),
        skill: form.get("skill"),
        cefrTarget: form.get("cefrTarget") || null,
        difficulty: form.get("difficulty") || null,
        estimatedMinutes: Number(form.get("estimatedMinutes")),
        courseId: form.get("courseId"),
        relatedModuleId: form.get("relatedModuleId") || null,
        relatedLessonId: form.get("relatedLessonId") || null,
        content: jsonField(form, "content"),
        answerKey: jsonField(form, "answerKey"),
        feedback: jsonField(form, "feedback"),
        itemKeys: jsonField(form, "itemKeys"),
      },
      creationKey,
      expected,
    );
    return result;
  } catch {
    return {
      status: "unavailable" as const,
      message: "Não foi possível salvar. Confira sua conexão e tente novamente.",
    };
  }
}
