import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

const root = process.cwd();
const ignoredDirectories = new Set([
  ".git",
  ".next",
  "node_modules",
  "coverage",
  "storybook-static",
  "playwright-report",
  "test-results",
  "artifacts",
]);
const textExtensions = new Set([
  ".cjs", ".css", ".env", ".example", ".js", ".json", ".jsx", ".md", ".mjs",
  ".ps1", ".sh", ".sql", ".toml", ".ts", ".tsx", ".txt", ".yaml", ".yml",
]);
const allowedEnvFiles = new Set([".env.example"]);

const secretPatterns = [
  ["GitHub classic PAT", /\bghp_[A-Za-z0-9]{20,}\b/g],
  ["GitHub fine-grained PAT", /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g],
  ["Supabase secret key", /\bsb_secret_[A-Za-z0-9_-]{16,}\b/g],
  ["Vercel personal token", /\bvcp_[A-Za-z0-9_-]{16,}\b/g],
  ["Vercel integration token", /\bvci_[A-Za-z0-9_-]{16,}\b/g],
  ["Vercel app token", /\bvca_[A-Za-z0-9_-]{16,}\b/g],
  ["Vercel refresh token", /\bvcr_[A-Za-z0-9_-]{16,}\b/g],
  ["Vercel API key", /\bvck_[A-Za-z0-9_-]{16,}\b/g],
  ["AWS access key", /\bAKIA[0-9A-Z]{16}\b/g],
  ["Private key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
];

const findings = [];

function visit(directory) {
  for (const entry of readdirSync(directory)) {
    if (ignoredDirectories.has(entry)) continue;
    const absolute = join(directory, entry);
    const info = statSync(absolute);
    if (info.isDirectory()) {
      visit(absolute);
      continue;
    }

    const path = relative(root, absolute).replaceAll("\\", "/");
    const base = path.split("/").at(-1);
    if (base?.startsWith(".env") && !allowedEnvFiles.has(base)) {
      findings.push({ path, type: "Committed environment file" });
      continue;
    }

    const extension = extname(path);
    if (!textExtensions.has(extension) && !base?.startsWith(".env")) continue;
    if (info.size > 2_000_000) continue;

    let content;
    try {
      content = readFileSync(absolute, "utf8");
    } catch {
      continue;
    }

    for (const [name, pattern] of secretPatterns) {
      pattern.lastIndex = 0;
      if (pattern.test(content)) findings.push({ path, type: name });
    }
  }
}

visit(root);

if (findings.length > 0) {
  for (const finding of findings) {
    console.error(`✗ ${finding.type}: ${finding.path}`);
  }
  process.exit(1);
}

console.log("✓ Secret scan passed.");
