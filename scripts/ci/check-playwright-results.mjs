import { appendFileSync, existsSync, readFileSync } from "node:fs";

// Fail-closed gate over a Playwright JSON report: a green run must not hide skipped or retried-until-green tests.
// Usage: node scripts/ci/check-playwright-results.mjs <report.json> <label>
// Overrides (explicit, for investigation only): YAS_ALLOW_FLAKY=1, YAS_ALLOW_SKIPPED=1.
const [file, label = "Playwright"] = process.argv.slice(2);

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

if (!file) fail("Usage: check-playwright-results.mjs <report.json> <label>");
if (!existsSync(file)) fail(`${label}: Playwright JSON report not found at ${file}.`);

let report;
try {
  report = JSON.parse(readFileSync(file, "utf8"));
} catch {
  fail(`${label}: Playwright JSON report is not valid JSON.`);
}

const found = { flaky: [], skipped: [], unexpected: [] };
function walk(suite, parents = []) {
  const path = suite.title ? [...parents, suite.title] : parents;
  for (const spec of suite.specs ?? []) {
    for (const test of spec.tests ?? []) {
      const name = `${suite.file ?? spec.file ?? path[0] ?? "?"} › ${spec.title}`;
      if (test.status === "flaky") found.flaky.push(name);
      else if (test.status === "skipped") found.skipped.push(name);
      else if (test.status === "unexpected") found.unexpected.push(name);
    }
  }
  for (const child of suite.suites ?? []) walk(child, path);
}
for (const suite of report.suites ?? []) walk(suite);

const stats = report.stats ?? {};
const lines = [
  `### ${label}`,
  "",
  `| passed | flaky | skipped | failed |`,
  `| --- | --- | --- | --- |`,
  `| ${stats.expected ?? 0} | ${found.flaky.length} | ${found.skipped.length} | ${found.unexpected.length} |`,
];
for (const [title, names] of [
  ["Flaky (passed only after a retry)", found.flaky],
  ["Skipped", found.skipped],
]) {
  if (names.length) lines.push("", `**${title}**`, ...names.map((n) => `- ${n}`));
}
const summary = `${lines.join("\n")}\n`;
console.log(summary);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);

const problems = [];
if (found.unexpected.length) problems.push(`${found.unexpected.length} failed test(s)`);
if (found.skipped.length && process.env.YAS_ALLOW_SKIPPED !== "1") {
  problems.push(`${found.skipped.length} skipped test(s) (a skipped test hides coverage)`);
}
if (found.flaky.length && process.env.YAS_ALLOW_FLAKY !== "1") {
  problems.push(`${found.flaky.length} flaky test(s) (passed only after a retry)`);
}
if (problems.length) fail(`${label}: ${problems.join("; ")}.`);
console.log(`✓ ${label}: no skipped, flaky or failed tests.`);
