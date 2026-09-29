import { assert, read, success, walk } from "./_verify-utils.mjs";

const browserClient = read("src/lib/supabase/browser.ts");
const serverEnv = read("src/server/env.ts");
const adminClient = read("src/server/supabase/admin.ts");
const envExample = read(".env.example");

assert(!/NEXT_PUBLIC_[A-Z0-9_]*SERVICE_ROLE/.test(browserClient), "Browser Supabase client references a service-role variable.");
assert(!/NEXT_PUBLIC_[A-Z0-9_]*SERVICE_ROLE/.test(envExample), ".env.example exposes service role through NEXT_PUBLIC_*.");
assert(serverEnv.includes('import "server-only"'), "src/server/env.ts must import server-only.");
assert(adminClient.includes('import "server-only"'), "Supabase admin client must import server-only.");
assert(serverEnv.includes("SUPABASE_SERVICE_ROLE_KEY"), "Server env contract lost the service-role key.");
assert(envExample.includes("SUPABASE_SERVICE_ROLE_KEY=your-service-role-key"), ".env.example must keep a non-secret service-role placeholder.");

const sourceFiles = walk("src", (path) => /\.(?:ts|tsx|js|jsx|mjs|cjs)$/.test(path));
for (const path of sourceFiles) {
  const content = read(path);
  if (/NEXT_PUBLIC_[A-Z0-9_]*SERVICE_ROLE/.test(content)) {
    throw new Error(`Public service-role exposure pattern found in ${path}`);
  }
  if (content.includes("SUPABASE_SERVICE_ROLE_KEY") && path !== "src/server/env.ts") {
    throw new Error(`Direct service-role env access outside src/server/env.ts: ${path}`);
  }
}

const scanFiles = [
  ...sourceFiles,
  ".env.example",
  "next.config.ts",
  "playwright.config.ts",
  "vitest.config.ts",
];
const secretPatterns = [
  /sk_live_[A-Za-z0-9]{16,}/,
  /ghp_[A-Za-z0-9]{20,}/,
  /github_pat_[A-Za-z0-9_]{20,}/,
  /sb_secret_[A-Za-z0-9_-]{16,}/,
];

for (const path of scanFiles) {
  const content = read(path);
  for (const pattern of secretPatterns) {
    assert(!pattern.test(content), `High-confidence secret pattern found in ${path}`);
  }
}

success(`Security boundary valid across ${sourceFiles.length} source files; no high-confidence committed secret pattern found.`);
