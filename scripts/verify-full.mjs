import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

function run(command, args, env = process.env, capture = false) {
  const result = spawnSync(command, args, {
    env,
    encoding: capture ? "utf8" : undefined,
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    shell: process.platform === "win32",
  });

  if (result.error?.code === "ENOENT") {
    throw new Error(`${command} is required for full verification.`);
  }
  if (result.status !== 0) {
    if (capture) {
      process.stderr.write(result.stderr ?? "");
      process.stdout.write(result.stdout ?? "");
    }
    throw new Error(`Command failed: ${command} ${args.join(" ")}`);
  }
  return result;
}

function parseEnv(text) {
  return Object.fromEntries(
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        const key = line.slice(0, index);
        let value = line.slice(index + 1);
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        return [key, value];
      }),
  );
}

function prepareFixture(env) {
  run(process.execPath, ["scripts/setup-canonical-e2e.mjs"], env);
}

console.log("\n=== Yas full verification ===");
run("supabase", ["--version"]);
run("psql", ["--version"]);

let supabaseStarted = false;
try {
  run("supabase", ["start"]);
  supabaseStarted = true;
  run("supabase", ["db", "reset"]);

  const status = run("supabase", ["status", "-o", "env"], process.env, true);
  const local = parseEnv(status.stdout ?? "");
  const publicKey = local.PUBLISHABLE_KEY ?? local.ANON_KEY;
  const serviceKey = local.SECRET_KEY ?? local.SERVICE_ROLE_KEY;

  if (!local.API_URL || !local.DB_URL || !publicKey || !serviceKey) {
    throw new Error("Supabase status did not expose the required local credentials.");
  }

  const runtimeEnv = {
    ...process.env,
    APP_URL: "http://127.0.0.1:3000",
    NEXT_PUBLIC_SUPABASE_URL: local.API_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publicKey,
    SUPABASE_SERVICE_ROLE_KEY: serviceKey,
    SUPABASE_PROTECTED_ASSETS_BUCKET: "yas-protected-assets",
    DATABASE_URL: local.DB_URL,
    CANONICAL_E2E: "1",
    CANONICAL_E2E_PASSWORD: randomBytes(30).toString("base64url"),
  };

  run(npmCommand, ["run", "verify"], runtimeEnv);
  run(npmCommand, ["run", "verify:harness"], runtimeEnv);
  run(npmCommand, ["run", "verify:security"], runtimeEnv);
  run(npmCommand, ["run", "eval:agent"], runtimeEnv);

  prepareFixture(runtimeEnv);
  run(npmCommand, ["run", "test:e2e"], runtimeEnv);
  run(process.execPath, ["scripts/assert-canonical-e2e.mjs"], runtimeEnv);

  prepareFixture(runtimeEnv);
  run(npmCommand, ["run", "test:a11y"], runtimeEnv);

  run(npmCommand, ["run", "storybook:build"], runtimeEnv);
  run(npmCommand, ["run", "test:visual:storybook"], runtimeEnv);

  prepareFixture(runtimeEnv);
  run(npmCommand, ["run", "test:visual:golden"], runtimeEnv);

  console.log("\n✓ Full verification passed: core + DB integration + RLS + E2E + a11y + visual.");
} finally {
  if (supabaseStarted) {
    spawnSync("supabase", ["stop", "--no-backup"], {
      stdio: "inherit",
      shell: process.platform === "win32",
    });
  }
}
