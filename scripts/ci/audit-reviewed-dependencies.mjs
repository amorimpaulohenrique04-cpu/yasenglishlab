import { readFileSync } from "node:fs";

import { spawnNpmSync } from "../_npm-cli.mjs";

const advisoryUrl = "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm";
const allowedNames = new Set([
  "braces",
  "micromatch",
  "fast-glob",
  "@next/eslint-plugin-next",
  "eslint-config-next",
]);

function audit(extraArgs = []) {
  const result = spawnNpmSync(["audit", "--audit-level=high", "--json", ...extraArgs], {
    encoding: "utf8",
  });
  let report;
  try {
    report = JSON.parse(result.stdout || "{}");
  } catch {
    process.stderr.write(result.stderr || "");
    process.stdout.write(result.stdout || "");
    throw new Error("npm audit did not return parseable JSON.");
  }
  return { result, report };
}

const production = audit(["--omit=dev"]);
const prodCounts = production.report.metadata?.vulnerabilities ?? {};
if (
  production.result.status !== 0 ||
  Number(prodCounts.high ?? 0) > 0 ||
  Number(prodCounts.critical ?? 0) > 0
) {
  process.stdout.write(production.result.stdout || "");
  process.stderr.write(production.result.stderr || "");
  throw new Error("Production dependency audit contains a high/critical finding.");
}
console.log("✓ Production dependency audit is clean at audit-level=high.");

const full = audit();
const vulnerabilities = full.report.vulnerabilities ?? {};
if (full.result.status === 0 && Object.keys(vulnerabilities).length === 0) {
  console.log("✓ Full dependency audit is clean.");
  process.exit(0);
}

const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
let sawDirectBracesAdvisory = false;
for (const [name, vulnerability] of Object.entries(vulnerabilities)) {
  if (!allowedNames.has(name)) {
    process.stdout.write(full.result.stdout || "");
    throw new Error(`Unreviewed audit finding: ${name}`);
  }
  for (const node of vulnerability.nodes ?? []) {
    const descriptor = lock.packages?.[node];
    if (!descriptor || descriptor.dev !== true) {
      throw new Error(`Reviewed advisory escaped the dev-only graph at ${node}`);
    }
  }
  for (const via of vulnerability.via ?? []) {
    if (typeof via === "string") {
      if (!allowedNames.has(via))
        throw new Error(`Unexpected meta-vulnerability dependency ${via} for ${name}`);
      continue;
    }
    if (via?.url !== advisoryUrl) {
      throw new Error(
        `Unexpected direct advisory for ${name}: ${via?.url ?? via?.title ?? "unknown"}`,
      );
    }
    if (name === "braces") sawDirectBracesAdvisory = true;
  }
}
if (!sawDirectBracesAdvisory)
  throw new Error("The only permitted temporary audit exception is the patched braces advisory.");

console.log("npm audit still reports the patched dev-only advisory by package version:");
for (const name of Object.keys(vulnerabilities)) console.log("  - " + name);
console.log(
  "✓ Full audit remained fail-closed: only the source-patched GHSA-vfj7-8cjw-p6xm chain was present.",
);
