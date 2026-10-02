import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

import { loginCanonicalAdmin } from "../helpers/admin-mfa";

const enabled = process.env.CANONICAL_E2E === "1";
const password = process.env.CANONICAL_E2E_PASSWORD;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const assetId = "8c100000-0000-4000-8000-000000000001";
const lessonId = "42000000-0000-4000-8000-000000000003";
const lessonUrl =
  "/aulas/yas-foundations/modulos/41000000-0000-4000-8000-000000000001/aulas/build-your-first-conversation";

if (enabled && (!password || !url || !serviceRoleKey)) {
  throw new Error("Recorded Video E2E requires canonical local Supabase credentials.");
}

const admin =
  url && serviceRoleKey
    ? createClient(url, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

async function userId(email: string): Promise<string> {
  if (!admin) throw new Error("Service-role client unavailable.");
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  const user = data.users.find((item) => item.email === email);
  if (!user) throw new Error(`Canonical user missing: ${email}`);
  return user.id;
}

async function resetVideo(): Promise<void> {
  if (!admin) return;
  const student = await userId("canonical.student@example.test");

  const { error: draftError } = await admin
    .from("lesson_assets")
    .update({ publication_status: "DRAFT", published_at: null })
    .eq("id", assetId);
  if (draftError) throw draftError;

  const { error: videoError } = await admin
    .from("lesson_video_assets")
    .update({
      provider_upload_id: null,
      provider_asset_id: null,
      provider_playback_id: null,
      processing_status: "AWAITING_UPLOAD",
      duration_seconds: null,
      aspect_ratio: null,
      caption_language: "en",
      caption_status: "NOT_REQUESTED",
      thumbnail_metadata: {},
      last_provider_error: null,
      ready_at: null,
    })
    .eq("lesson_asset_id", assetId);
  if (videoError) throw videoError;

  const { data: video, error: lookupError } = await admin
    .from("lesson_video_assets")
    .select("id")
    .eq("lesson_asset_id", assetId)
    .single();
  if (lookupError) throw lookupError;
  const { error: eventsError } = await admin
    .from("media_provider_events")
    .delete()
    .eq("video_asset_id", video.id);
  if (eventsError) throw eventsError;

  const { error: progressError } = await admin
    .from("lesson_progress")
    .delete()
    .eq("user_id", student)
    .eq("lesson_id", lessonId);
  if (progressError) throw progressError;
  const { error: analyticsError } = await admin
    .from("product_analytics_events")
    .delete()
    .eq("user_id", student)
    .eq("lesson_id", lessonId)
    .in("event_name", ["lesson_video_started", "lesson_video_resumed", "lesson_video_completed"]);
  if (analyticsError) throw analyticsError;
}

async function loginStudent(page: Page, email = "canonical.student@example.test"): Promise<void> {
  if (!password) throw new Error("CANONICAL_E2E_PASSWORD is required.");
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/home$/);
}

async function dispatchPlayerEvent(page: Page, type: "play" | "pause" | "ended", time: number) {
  const player = page.locator("mux-player");
  await expect(player).toBeVisible();
  await player.evaluate(
    (node, input) => {
      Object.defineProperty(node, "currentTime", {
        configurable: true,
        get: () => input.time,
        set: () => undefined,
      });
      node.dispatchEvent(new Event(input.type, { bubbles: true, composed: true }));
    },
    { type, time },
  );
}

test.describe("P21.6 Recorded Video Learning V1", () => {
  test.skip(!enabled, "Requires the local Supabase E2E stack.");
  test.setTimeout(180_000);

  test.beforeEach(async () => {
    await resetVideo();
  });

  test("Admin upload uses fake provider; Student gets signed playback, resume and idempotent completion", async ({
    page,
    browser,
  }) => {
    if (!password || !admin) throw new Error("Canonical E2E environment is incomplete.");

    await loginCanonicalAdmin(page, password, {
      next: `/admin/content/${assetId}?kind=lesson_assets`,
      destination: new RegExp(`/admin/content/${assetId}\\?kind=lesson_assets$`),
    });

    await expect(page.getByRole("heading", { name: "Vídeo gravado" })).toBeVisible();
    await expect(page.getByText(/Estado: AWAITING_UPLOAD/)).toBeVisible();

    let uploadHostname: string | null = null;
    page.on("request", (request) => {
      const target = new URL(request.url());
      if (request.method() === "PUT" && target.pathname.startsWith("/upload/")) {
        uploadHostname = target.hostname;
      }
    });

    await page.getByRole("button", { name: "Preparar envio de vídeo" }).click();
    const uploader = page.locator("mux-uploader");
    await expect(uploader).toBeVisible();
    const fileInput = uploader.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "canonical-video.mp4",
      mimeType: "video/mp4",
      buffer: Buffer.from("canonical fake provider payload"),
    });

    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "Upload recebido. Aguarde o processamento e atualize esta página." }),
    ).toBeVisible({ timeout: 30_000 });
    expect(uploadHostname).toBe("127.0.0.1");

    await expect
      .poll(
        async () => {
          const { data } = await admin
            .from("lesson_video_assets")
            .select("processing_status,caption_status,provider_playback_id")
            .eq("lesson_asset_id", assetId)
            .single();
          return data;
        },
        { timeout: 30_000 },
      )
      .toMatchObject({
        processing_status: "READY",
        caption_status: "READY",
        provider_playback_id: "core-test-playback",
      });

    await page.reload();
    await expect(page.getByText(/Estado: READY · Legendas: READY/)).toBeVisible();

    await page.goto("/admin/content?kind=lesson_assets");
    const lessonGroup = page.locator("section").filter({
      has: page.getByRole("heading", {
        name: "Build your first conversation",
        exact: true,
      }),
    });
    const videoCard = lessonGroup
      .locator("article,section,div")
      .filter({
        has: page.getByRole("heading", { name: "VIDEO", exact: true }),
      })
      .last();
    await expect(page.getByRole("heading", { name: "VIDEO", exact: true })).toBeVisible();
    await videoCard.getByRole("button", { name: "Publicar VIDEO" }).click();
    await expect(page.getByText("Conteúdo publicado", { exact: true })).toBeVisible();

    const studentContext = await browser.newContext();
    try {
      const studentPage = await studentContext.newPage();
      await loginStudent(studentPage);
      await studentPage.goto(lessonUrl);

      await expect(
        studentPage.getByRole("heading", { name: "Build your first conversation" }),
      ).toBeVisible();
      await expect(studentPage.getByText("Legendas disponíveis (en) no player.")).toBeVisible();
      await expect(studentPage.locator("mux-player")).toBeVisible();
      await expect(studentPage.locator("mux-player")).toHaveAttribute(
        "playback-id",
        /core-test-playback/,
      );

      await dispatchPlayerEvent(studentPage, "pause", 17);
      const student = await userId("canonical.student@example.test");
      await expect
        .poll(async () => {
          const { data } = await admin
            .from("lesson_progress")
            .select("last_position_seconds")
            .eq("user_id", student)
            .eq("lesson_id", lessonId)
            .maybeSingle();
          return data?.last_position_seconds ?? null;
        })
        .toBe(17);

      await studentPage.reload();
      await expect(studentPage.getByText("Última posição: 0 min 17 s")).toBeVisible();
      await dispatchPlayerEvent(studentPage, "play", 17);

      await expect
        .poll(async () => {
          const { count } = await admin
            .from("product_analytics_events")
            .select("id", { count: "exact", head: true })
            .eq("user_id", student)
            .eq("lesson_id", lessonId)
            .eq("event_name", "lesson_video_resumed");
          return count ?? 0;
        })
        .toBe(1);

      await dispatchPlayerEvent(studentPage, "ended", 32);
      await expect
        .poll(async () => {
          const { data } = await admin
            .from("lesson_progress")
            .select("completion_percent,last_position_seconds")
            .eq("user_id", student)
            .eq("lesson_id", lessonId)
            .single();
          return data;
        })
        .toMatchObject({ completion_percent: 100, last_position_seconds: 32 });

      await dispatchPlayerEvent(studentPage, "ended", 32);
      await expect
        .poll(async () => {
          const { count } = await admin
            .from("product_analytics_events")
            .select("id", { count: "exact", head: true })
            .eq("user_id", student)
            .eq("lesson_id", lessonId)
            .eq("event_name", "lesson_video_completed");
          return count ?? 0;
        })
        .toBe(1);

      await studentPage.reload();
      await expect(studentPage.getByText("Concluída", { exact: true })).toBeVisible();

      const deniedContext = await browser.newContext();
      try {
        const denied = await deniedContext.newPage();
        await loginStudent(denied, "canonical.progress-empty@example.test");
        await denied.goto(lessonUrl);
        await expect(denied.getByRole("heading", { name: "Aula não disponível" })).toBeVisible();
        await expect(denied.locator("mux-player")).toHaveCount(0);
      } finally {
        await deniedContext.close();
      }
    } finally {
      await studentContext.close();
    }
  });
});
