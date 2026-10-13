import { muxClient, muxWebhookSecret } from "@/server/media/mux-provider";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
export const runtime = "nodejs";
const MAX_BYTES = 1048576;
const UNKNOWN_ASSET_RETRY_WINDOW_MS = 24 * 60 * 60 * 1000;
async function boundedText(request: Request): Promise<string | null> {
  if (Number(request.headers.get("content-length")) > MAX_BYTES) return null;
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks).toString("utf8");
}
export async function POST(request: Request) {
  const raw = await boundedText(request);
  if (raw === null) return new Response(null, { status: 413 });
  let event;
  try {
    event = await muxClient().webhooks.unwrap(raw, request.headers, muxWebhookSecret());
  } catch {
    return new Response(null, { status: 401 });
  }
  const supported = [
    "video.upload.asset_created",
    "video.asset.ready",
    "video.asset.errored",
    "video.asset.track.ready",
    "video.asset.track.errored",
  ];
  if (!supported.includes(event.type)) return new Response(null, { status: 204 });
  const data = event.data as unknown as Record<string, unknown>;
  if (event.type.includes("track") && data.type !== "text")
    return new Response(null, { status: 204 });
  const admin = createSupabaseAdminClient();
  const assetId =
    event.type === "video.upload.asset_created"
      ? data.asset_id
      : event.type.includes("track")
        ? data.asset_id
        : data.id;
  let query = admin.from("lesson_video_assets").select("id,provider_upload_id");
  if (typeof data.passthrough === "string") query = query.eq("id", data.passthrough);
  else if (event.type === "video.upload.asset_created")
    query = query.eq("provider_upload_id", data.id);
  else query = query.eq("provider_asset_id", assetId);
  const { data: video, error } = await query.maybeSingle();
  if (error) return new Response(null, { status: 503 });
  if (!video) {
    const created = Date.parse(String((event as { created_at?: unknown }).created_at ?? ""));
    const recent =
      Number.isFinite(created) && Date.now() - created <= UNKNOWN_ASSET_RETRY_WINDOW_MS;
    return new Response(null, { status: recent ? 503 : 204 });
  }
  const playbackIds = Array.isArray(data.playback_ids)
    ? (data.playback_ids as { id: string; policy: string }[])
    : [];
  const { data: status, error: processError } = await admin.rpc("process_mux_provider_event", {
    p_event_id: event.id,
    p_event_type: event.type,
    p_video_id: video.id,
    p_upload_id: event.type === "video.upload.asset_created" ? data.id : (data.upload_id ?? null),
    p_asset_id: assetId,
    p_playback_id: playbackIds.find((item) => item.policy === "signed")?.id ?? null,
    p_duration: data.duration ?? null,
    p_aspect_ratio: data.aspect_ratio ?? null,
  });
  return new Response(null, { status: processError || status === "PENDING" ? 503 : 204 });
}
