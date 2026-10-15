import { z } from "zod";

import type { LearningLesson, LessonAccess } from "./models";

export const COHORT_TIME_ZONE = "America/Recife";

const itemSchema = z.object({
  contentKind: z.string(),
  contentId: z.guid(),
  position: z.coerce.number(),
  availableFrom: z.string().nullable().optional(),
  state: z.enum(["AVAILABLE", "LOCKED_DATE", "LOCKED_SEQUENCE"]),
});

const pathSchema = z.object({ items: z.array(itemSchema) });

export interface LessonPathEntry {
  position: number;
  access: LessonAccess;
}

/** Parses the get_student_learning_path payload into lesson entries keyed by lesson id. */
export function parseLessonPath(payload: unknown): Map<string, LessonPathEntry> {
  const parsed = pathSchema.safeParse(payload);
  if (!parsed.success) throw new Error("Unable to read the learning path.");
  const entries = new Map<string, LessonPathEntry>();
  for (const item of parsed.data.items) {
    if (item.contentKind !== "lessons") continue;
    entries.set(item.contentId, {
      position: item.position,
      access: { state: item.state, availableFrom: item.availableFrom ?? null },
    });
  }
  return entries;
}

export function isLessonLocked(lesson: Pick<LearningLesson, "access">): boolean {
  return Boolean(lesson.access && lesson.access.state !== "AVAILABLE");
}

function formatRelease(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: COHORT_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("day")}/${get("month")} às ${get("hour")}:${get("minute")}`;
}

/** Human PT-BR reason for a locked lesson; null when the lesson is available. */
export function lessonLockMessage(lesson: Pick<LearningLesson, "access">): string | null {
  const access = lesson.access;
  if (!access || access.state === "AVAILABLE") return null;
  if (access.state === "LOCKED_DATE") {
    const when = access.availableFrom ? formatRelease(access.availableFrom) : null;
    return when
      ? `Disponível em ${when} (${COHORT_TIME_ZONE})`
      : "Esta aula será liberada em breve.";
  }
  return "Conclua a aula anterior para liberar";
}
