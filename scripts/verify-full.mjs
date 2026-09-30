import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

import { spawnNpmSync } from "./_npm-cli.mjs";

function run(command, args, env = process.env, capture = false) {
  const result = spawnSync(command, args, {
    env,
    encoding: capture ? "utf8" : undefined,
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
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

function runNpm(args, env = process.env) {
  const result = spawnNpmSync(args, { env, stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`Command failed: npm ${args.join(" ")}`);
  }
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
  if (!existsSync("supabase/config.toml")) {
    run("supabase", ["init"]);
  }
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

  runNpm(["run", "verify"], runtimeEnv);
  runNpm(["run", "verify:harness"], runtimeEnv);
  runNpm(["run", "verify:security"], runtimeEnv);
  runNpm(["run", "eval:agent"], runtimeEnv);

  prepareFixture(runtimeEnv);
  runNpm(["run", "test:e2e"], runtimeEnv);
  run(process.execPath, ["scripts/assert-canonical-e2e.mjs"], runtimeEnv);

  prepareFixture(runtimeEnv);
  runNpm(["run", "test:a11y"], runtimeEnv);

  runNpm(["run", "storybook:build"], runtimeEnv);
  runNpm(["run", "test:visual:storybook"], runtimeEnv);

  prepareFixture(runtimeEnv);
  runNpm(["run", "test:visual:golden"], runtimeEnv);

  console.log("\n✓ Full verification passed: core + DB integration + RLS + E2E + a11y + visual.");
} finally {
  if (supabaseStarted) {
    spawnSync("supabase", ["stop", "--no-backup"], {
      stdio: "inherit",
    });
  }
}
