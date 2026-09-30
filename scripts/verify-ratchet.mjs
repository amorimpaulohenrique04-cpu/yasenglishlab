import { assert, exists, read, success, walk } from "./_verify-utils.mjs";

const classifications = new Set([
  "context",
  "tool",
  "environment",
  "state",
  "architecture",
  "security",
  "ui contract",
  "test gap",
  "observability",
  "permission",
  "dependency",
  "agent behavior",
]);

const statuses = new Set(["open", "resolved", "accepted-risk"]);
const requiredSections = [
  "Symptom",
  "Evidence",
  "Root cause",
  "Responsible layer",
  "Immediate fix",
  "Permanent protection",
  "Test/eval created",
  "Reproduction",
  "Before/after proof",
];

function escapeRegExp(value) {
  return value.replace(/[.*+?^$()|[\]\\{}]/g, "\\$&");
}

function metadata(markdown, key) {
  const match = markdown.match(new RegExp("^" + escapeRegExp(key) + ":\\s*(.+)$", "im"));
  return match?.[1]?.trim() ?? "";
}

function section(markdown, heading) {
  const marker = "## " + heading;
  const start = markdown.indexOf(marker);
  if (start < 0) return "";
  const tail = markdown.slice(start + marker.length);
  const next = tail.search(/\n## /);
  return (next < 0 ? tail : tail.slice(0, next)).trim();
}

function meaningful(value) {
  const normalized = value.trim().toLowerCase();
  return Boolean(normalized) && !/^(none|n\/a)(?:\s|$)/.test(normalized);
}

function validateFailureRecord(name, markdown) {
  const errors = [];
  const classification = metadata(markdown, "Classification").toLowerCase();
  const status = metadata(markdown, "Status").toLowerCase();
  const repeatable = metadata(markdown, "Repeatable").toLowerCase();
  const date = metadata(markdown, "Date");
  const related = metadata(markdown, "PR/commit related");

  if (!classifications.has(classification)) {
    errors.push('invalid classification "' + (classification || "<missing>") + '"');
  }
  if (!statuses.has(status)) {
    errors.push('invalid status "' + (status || "<missing>") + '"');
  }
  if (!["yes", "no"].includes(repeatable)) {
    errors.push('Repeatable must be yes or no, got "' + (repeatable || "<missing>") + '"');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date + "T00:00:00Z"))) {
    errors.push("Date must be YYYY-MM-DD");
  }
  if (!related) errors.push("PR/commit related is required");

  for (const heading of requiredSections) {
    if (!section(markdown, heading)) {
      errors.push("missing or empty section: " + heading);
    }
  }

  if (repeatable === "yes" && status === "resolved") {
    if (!meaningful(section(markdown, "Permanent protection"))) {
      errors.push("resolved repeatable failure requires permanent protection");
    }
    if (!meaningful(section(markdown, "Test/eval created"))) {
      errors.push("resolved repeatable failure requires a test/eval");
    }

    const proof = section(markdown, "Before/after proof");
    if (!/^Before:\s*\S/im.test(proof)) {
      errors.push("resolved repeatable failure requires Before proof");
    }
    if (!/^After:\s*\S/im.test(proof)) {
      errors.push("resolved repeatable failure requires After proof");
    }
  }

  return errors.map((error) => name + ": " + error);
}

const requiredPaths = [
  "docs/adr/TEMPLATE.md",
  "harness/failure-log/TEMPLATE.md",
  "harness/ratchet.md",
  "scripts/verify-ratchet.mjs",
];

for (const path of requiredPaths) {
  assert(exists(path), "Missing ratchet path: " + path);
}

const adrTemplate = read("docs/adr/TEMPLATE.md");
for (const marker of [
  "## Status",
  "## Date",
  "## Context",
  "## Decision",
  "## Alternatives",
  "## Consequences",
]) {
  assert(adrTemplate.includes(marker), "ADR template missing: " + marker);
}

const failureTemplate = read("harness/failure-log/TEMPLATE.md");
for (const marker of [
  "Classification:",
  "Status:",
  "Repeatable:",
  "Date:",
  "PR/commit related:",
  ...requiredSections.map((heading) => "## " + heading),
]) {
  assert(failureTemplate.includes(marker), "Failure template missing: " + marker);
}

const ratchet = read("harness/ratchet.md").toLowerCase();
for (const marker of [
  "reproduce",
  "capture evidence",
  "locate root cause",
  "smallest structural fix",
  "create a test/eval",
  "prove it failed before",
  "prove it passes after",
  "record",
  "quarter",
  "false positives",
  "remove",
]) {
  assert(ratchet.includes(marker), "Ratchet process missing concept: " + marker);
}

const badFixture = [
  "# Failure — controlled red fixture",
  "",
  "Classification: test gap",
  "Status: resolved",
  "Repeatable: yes",
  "Date: 2026-09-29",
  "PR/commit related: controlled-self-test",
  "",
  "## Symptom",
  "A repeatable failure was closed without a guard.",
  "## Evidence",
  "Controlled fixture.",
  "## Root cause",
  "The process allowed closure without protection.",
  "## Responsible layer",
  "Harness.",
  "## Immediate fix",
  "Document the incident.",
  "## Permanent protection",
  "None",
  "## Test/eval created",
  "None",
  "## Reproduction",
  "Validate this fixture.",
  "## Before/after proof",
  "Before: fixture reproduces the missing guard.",
  "After: fixture is still unprotected.",
  "",
].join("\n");

const goodFixture = badFixture
  .replace("## Permanent protection\nNone", "## Permanent protection\nnpm run verify:ratchet")
  .replace("## Test/eval created\nNone", "## Test/eval created\nControlled red/green self-test")
  .replace(
    "After: fixture is still unprotected.",
    "After: corrected fixture satisfies the permanent guard contract.",
  );

const redErrors = validateFailureRecord("controlled-red", badFixture);
assert(
  redErrors.some((error) => error.includes("requires permanent protection")) &&
    redErrors.some((error) => error.includes("requires a test/eval")),
  "Controlled red fixture was not rejected for the expected missing protections.",
);
assert(
  validateFailureRecord("controlled-green", goodFixture).length === 0,
  "Controlled green fixture did not pass after permanent protection was added.",
);

const records = walk(
  "harness/failure-log",
  (path) =>
    path.endsWith(".md") &&
    !path.endsWith("/README.md") &&
    !path.endsWith("/TEMPLATE.md"),
);

for (const path of records) {
  assert(
    /^harness\/failure-log\/\d{4}-\d{2}-\d{2}-[a-z0-9-]+\.md$/.test(path),
    "Invalid failure-log filename: " + path,
  );
  const errors = validateFailureRecord(path, read(path));
  assert(errors.length === 0, errors.join("\n"));
}

success(
  "Ratchet contract valid: controlled red fixture rejected, green fixture accepted, " +
    records.length +
    " durable failure record(s) verified.",
);
