import { generateKeyPairSync, createHmac } from "node:crypto";
import Mux from "@mux/mux-node";
import { describe, expect, it, vi } from "vitest";
import { FakeVideoProvider } from "../helpers/fake-video-provider";
vi.mock("server-only", () => ({}));
import { muxClient, MuxVideoProvider } from "@/server/media/mux-provider";
describe("Mux provider contract without external calls", () => {
  it("honors the explicit test API base URL without making a request", () => {
    vi.stubEnv("MUX_TOKEN_ID", "test");
    vi.stubEnv("MUX_TOKEN_SECRET", "test");
    vi.stubEnv("MUX_BASE_URL", "http://127.0.0.1:43123");
    try {
      expect(muxClient().baseURL).toBe("http://127.0.0.1:43123");
    } finally {
      vi.unstubAllEnvs();
    }
  });
  it("fake direct upload and playback contract have distinct credentials", async () => {
    const provider = new FakeVideoProvider();
    const upload = await provider.createDirectUpload({
      videoId: "video",
      origin: "http://localhost:3000",
      captionLanguage: "en",
    });
    expect(upload.uploadId).toBe("test-video");
    const playback = await provider.signPlayback({ playbackId: "playback", durationSeconds: 60 });
    expect(new Set(Object.values(playback.tokens)).size).toBe(3);
    expect(playback.expiresAt - Date.now()).toBeLessThanOrEqual(960000);
  });
  it("official SDK validates raw-body signatures and rejects tampering", async () => {
    const client = new Mux({ tokenId: "test", tokenSecret: "test" });
    const secret = "test-webhook-secret";
    const body = JSON.stringify({
      id: "event-test",
      type: "video.asset.ready",
      data: { id: "asset-test" },
    });
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
    const headers = { "mux-signature": `t=${timestamp},v1=${signature}` };
    await expect(client.webhooks.unwrap(body, headers, secret)).resolves.toMatchObject({
      id: "event-test",
    });
    await expect(client.webhooks.unwrap(body + " ", headers, secret)).rejects.toThrow();
    await expect(client.webhooks.unwrap(body, {}, secret)).rejects.toThrow();
  });
  it("Mux signing uses finite audience-specific JWTs without network", async () => {
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    vi.stubEnv("MUX_TOKEN_ID", "test");
    vi.stubEnv("MUX_TOKEN_SECRET", "test");
    vi.stubEnv("MUX_SIGNING_KEY_ID", "test-key");
    vi.stubEnv(
      "MUX_SIGNING_PRIVATE_KEY_BASE64",
      Buffer.from(privateKey.export({ type: "pkcs8", format: "pem" })).toString("base64"),
    );
    try {
      const result = await new MuxVideoProvider().signPlayback({
        playbackId: "test-playback",
        durationSeconds: 60,
      });
      const claims = Object.values(result.tokens).map((token) =>
        JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString()),
      );
      expect(claims.map((claim) => claim.aud).sort()).toEqual(["s", "t", "v"]);
      for (const claim of claims) {
        expect(claim.sub).toBe("test-playback");
        expect(claim.exp - Math.floor(Date.now() / 1000)).toBeLessThanOrEqual(960);
      }
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
