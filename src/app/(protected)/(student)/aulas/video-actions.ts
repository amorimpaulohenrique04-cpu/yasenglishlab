"use server";
import { z } from "zod";
import { recordCurrentStudentLessonProgress } from "@/server/learning/canonical-slice";
import { getLessonVideoPlayback } from "@/server/media/lesson-video";
import { assertRole } from "@/server/auth/guards";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { createProtectedAssetSignedUrl } from "@/server/assets/signed-url";
import { SupabaseProductAnalytics } from "@/server/analytics/supabase-product-analytics";
export async function lessonVideoAnalyticsAction(
  assetId: string,
  lessonId: string,
  event: "started" | "resumed" | "completed",
) {
  await assertRole("STUDENT");
  const id = z.uuid().parse(assetId);
  const lesson = z.uuid().parse(lessonId);
  const type = z.enum(["started", "resumed", "completed"]).parse(event);
  const client = await createSupabaseServerClient();
  await new SupabaseProductAnalytics(client).track({
    event: `lesson_video_${type}`,
    lessonId: lesson,
    properties: { lesson_asset_id: id },
    idempotencyKey: `lesson_video_${type}:${id}`,
  });
}
export async function lessonAssetAccessAction(assetId: string) {
  await assertRole("STUDENT");
  const id = z.uuid().parse(assetId);
  const client = await createSupabaseServerClient();
  const { data, error } = await client
    .from("lesson_assets")
    .select("id,source_url")
    .eq("id", id)
    .eq("publication_status", "PUBLISHED")
    .single();
  if (error || !data) throw new Error("Conteúdo indisponível.");
  if (data.source_url) {
    const url = new URL(z.url().parse(data.source_url));
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password)
      throw new Error("Conteúdo indisponível.");
    return url.href;
  }
  return createProtectedAssetSignedUrl({ kind: "lesson_asset", id });
}

export async function lessonVideoPlaybackAction(id: string) {
  return getLessonVideoPlayback(id);
}
export async function checkpointVideoAction(lessonId: string, position: number, ended: boolean) {
  const actor = await assertRole("STUDENT");
  const id = z.uuid().parse(lessonId);
  const seconds = z.number().int().nonnegative().parse(position);
  const complete = z.boolean().parse(ended);
  const client = await createSupabaseServerClient();
  const { data, error } = await client
    .from("lesson_progress")
    .select("completion_percent")
    .eq("lesson_id", id)
    .eq("user_id", actor.userId)
    .maybeSingle();
  if (error) throw new Error("Progresso indisponível.");
  await recordCurrentStudentLessonProgress({
    lessonId: id,
    completionPercent: complete ? 100 : Number(data?.completion_percent ?? 0),
    lastPositionSeconds: seconds,
  });
}
