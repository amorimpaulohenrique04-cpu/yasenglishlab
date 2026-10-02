import { muxClient, muxWebhookSecret } from "@/server/media/mux-provider";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > 1048576)
    return new Response(null, { status: 413 });
  const raw = await request.text();
  if (raw.length > 1048576) return new Response(null, { status: 413 });
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
  if (error || !video) return new Response(null, { status: 503 });
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
