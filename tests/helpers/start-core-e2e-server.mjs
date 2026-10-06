// Test-only provider transport. Production builds never load this file.
import { createServer } from "node:http";
import { createHmac, generateKeyPairSync, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const port = process.env.PLAYWRIGHT_PORT ?? "3000";
const env = { ...process.env };
let fake;
if (env.CANONICAL_E2E === "1") {
  env.BILLING_PROVIDER = "FAKE";
  env.ASAAS_WEBHOOK_TOKEN = "yas-commercial-local-webhook-test-only-token";
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  Object.assign(env, {
    MUX_TOKEN_ID: "local-test",
    MUX_TOKEN_SECRET: "local-test",
    MUX_WEBHOOK_SECRET: randomUUID(),
    MUX_SIGNING_KEY_ID: "local-test-key",
    MUX_SIGNING_PRIVATE_KEY_BASE64: Buffer.from(
      privateKey.export({ type: "pkcs8", format: "pem" }),
    ).toString("base64"),
  });
  const uploads = new Map();
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  async function notify(type, data) {
    const body = JSON.stringify({ id: randomUUID(), type, data });
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHmac("sha256", env.MUX_WEBHOOK_SECRET)
      .update(`${timestamp}.${body}`)
      .digest("hex");
    for (let retry = 0; retry < 20; retry++) {
      const response = await fetch(`http://127.0.0.1:${port}/api/webhooks/mux`, {
        method: "POST",
        body,
        headers: {
          "Content-Type": "application/json",
          "mux-signature": `t=${timestamp},v1=${signature}`,
        },
      });
      if (response.ok) return;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error("Local provider webhook delivery failed");
  }
  fake = createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", `http://127.0.0.1:${port}`);
    res.setHeader("Access-Control-Allow-Methods", "POST,PUT,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.setHeader("Access-Control-Expose-Headers", "Range");
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }
    if (req.method === "POST" && req.url === "/video/v1/uploads") {
      let raw = "";
      for await (const chunk of req) raw += chunk;
      const input = JSON.parse(raw);
      const id = randomUUID();
      uploads.set(id, input.new_asset_settings.passthrough);
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ data: { id, url: `${env.MUX_BASE_URL}/upload/${id}` } }));
      return;
    }
    if (req.method === "PUT" && req.url?.startsWith("/upload/")) {
      const id = req.url.slice(8),
        videoId = uploads.get(id);
      if (!videoId) {
        res.writeHead(404);
        res.end();
        return;
      }
      for await (const chunk of req) {
        void chunk;
      }
      res.writeHead(200);
      res.end();
      void (async () => {
        for (let retry = 0; retry < 30; retry++) {
          const { data } = await admin
            .from("lesson_video_assets")
            .select("provider_upload_id")
            .eq("id", videoId)
            .single();
          if (data?.provider_upload_id === id) break;
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        const asset = `asset-${id}`;
        await notify("video.upload.asset_created", { id, asset_id: asset, passthrough: videoId });
        await notify("video.asset.ready", {
          id: asset,
          upload_id: id,
          passthrough: videoId,
          duration: 32,
          aspect_ratio: "16:9",
          playback_ids: [{ id: "core-test-playback", policy: "signed" }],
        });
        await notify("video.asset.track.ready", {
          id: `captions-${id}`,
          type: "text",
          asset_id: asset,
          passthrough: videoId,
          language_code: "en",
        });
      })().catch(() => {
        console.error("Test provider delivery failed");
        process.exitCode = 1;
      });
      return;
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise((resolve) => fake.listen(0, "127.0.0.1", resolve));
  env.MUX_BASE_URL = `http://127.0.0.1:${fake.address().port}`;
}
const child = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", port],
  { env, stdio: "inherit" },
);
function stop() {
  child.kill();
  fake?.close();
}
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
child.on("exit", (code) => {
  fake?.close();
  process.exit(code ?? 0);
});
