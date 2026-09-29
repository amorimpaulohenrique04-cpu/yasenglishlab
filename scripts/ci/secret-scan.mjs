import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const patterns = [
  ["private key", /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  ["GitHub token", /\bgh[pousr]_[A-Za-z0-9]{30,}\b/],
  ["GitHub fine-grained token", /\bgithub_pat_[A-Za-z0-9_]{20,}\b/],
  ["Supabase secret key", /\bsb_secret_[A-Za-z0-9_-]{20,}\b/],
  ["Stripe live secret", /\bsk_live_[A-Za-z0-9]{20,}\b/],
  ["OpenAI secret", /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/],
  ["AWS access key", /\bAKIA[0-9A-Z]{16}\b/],
];

const excludedPrefixes = [
  ".git/",
  "node_modules/",
  ".next/",
  "coverage/",
  "storybook-static/",
  "playwright-report/",
  "test-results/",
  "artifacts/",
];

function listCandidateFiles() {
  const result = spawnSync("git", ["ls-files", "-co", "--exclude-standard", "-z"], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error("git ls-files failed; secret scan cannot establish repository scope.");
  }
  return result.stdout.split("\0").filter(Boolean);
}

let findings = 0;

for (const path of listCandidateFiles()) {
  if (excludedPrefixes.some((prefix) => path.startsWith(prefix))) continue;

  let content;
  try {
    content = readFileSync(path);
  } catch {
    continue;
  }

  if (content.length > 2_000_000 || content.includes(0)) continue;
  const text = content.toString("utf8");

  for (const [label, pattern] of patterns) {
    if (pattern.test(text)) {
      findings += 1;
      console.error(`✗ ${label} detected in ${path}`);
    }
  }
}

if (findings > 0) {
  console.error(`Secret scan failed with ${findings} finding(s).`);
  process.exit(1);
}

console.log("✓ secret scan passed.");
