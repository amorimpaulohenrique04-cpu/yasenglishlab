import "server-only";
import Mux from "@mux/mux-node";
import { z } from "zod";
import type { VideoProviderPort } from "@/modules/learning/application/video-provider";
import { playbackTtl } from "@/modules/learning/application/video-provider";
function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing server variable: ${name}`);
  return value;
}
export function muxClient() {
  return new Mux({
    tokenId: required("MUX_TOKEN_ID"),
    tokenSecret: required("MUX_TOKEN_SECRET"),
    timeout: 15000,
    maxRetries: 0,
  });
}
export class MuxVideoProvider implements VideoProviderPort {
  async createDirectUpload(input: { videoId: string; origin: string; captionLanguage: string }) {
    const result = await muxClient().video.uploads.create({
      cors_origin: input.origin,
      new_asset_settings: {
        playback_policies: ["signed"],
        passthrough: input.videoId,
        inputs: [
          {
            generated_subtitles: [
              {
                language_code: z
                  .enum([
                    "en",
                    "es",
                    "it",
                    "pt",
                    "de",
                    "fr",
                    "pl",
                    "ru",
                    "nl",
                    "ca",
                    "tr",
                    "sv",
                    "uk",
                    "no",
                    "fi",
                    "sk",
                    "el",
                    "cs",
                    "hr",
                    "da",
                    "ro",
                    "bg",
                    "auto",
                  ])
                  .parse(input.captionLanguage),
                name: "Captions",
              },
            ],
          },
        ],
      },
    });
    if (!result.url) throw new Error("Mux did not return an upload URL.");
    return { uploadId: result.id, uploadUrl: result.url };
  }
  async signPlayback(input: { playbackId: string; durationSeconds: number }) {
    const ttl = playbackTtl(input.durationSeconds);
    const client = muxClient();
    const config = {
      keyId: required("MUX_SIGNING_KEY_ID"),
      keySecret: required("MUX_SIGNING_PRIVATE_KEY_BASE64"),
      expiration: `${ttl}s`,
    };
    const [playback, thumbnail, storyboard] = await Promise.all([
      client.jwt.signPlaybackId(input.playbackId, { ...config, type: "video" }),
      client.jwt.signPlaybackId(input.playbackId, { ...config, type: "thumbnail" }),
      client.jwt.signPlaybackId(input.playbackId, { ...config, type: "storyboard" }),
    ]);
    return {
      playbackId: input.playbackId,
      tokens: { playback, thumbnail, storyboard },
      expiresAt: Date.now() + ttl * 1000,
    };
  }
}
export function muxWebhookSecret() {
  return required("MUX_WEBHOOK_SECRET");
}
