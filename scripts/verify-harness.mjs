import { assert, exists, read, run, success } from "./_verify-utils.mjs";

const requiredPaths = [
  "AGENTS.md",
  "harness/GOAL.template.md",
  "harness/feature_list.json",
  "harness/evals/behavioral.md",
  "harness/evals/AUTOMATION.md",
  "harness/agent-state/plan.md",
  "harness/agent-state/progress.md",
  "harness/agent-state/decisions.md",
  "harness/evidence/README.md",
  "harness/failure-log/README.md",
  "harness/failure-log/TEMPLATE.md",
  "harness/ratchet.md",
  "docs/adr/TEMPLATE.md",
  "scripts/verify-ratchet.mjs",
  "scripts/verify-engineering-system.mjs",
  "scripts/verify-platform.mjs",
  "harness/README.md",
  "scripts/verify.sh",
  "scripts/verify-ui.sh",
  "scripts/verify-security.sh",
  "scripts/verify-db.sh",
  "scripts/verify.ps1",
  "scripts/verify-ui.ps1",
  "scripts/verify-security.ps1",
  "scripts/verify-db.ps1",
];

for (const path of requiredPaths) {
  assert(exists(path), `Missing harness path: ${path}`);
}

const agents = read("AGENTS.md");
assert(agents.split("\n").length <= 100, "AGENTS.md must stay short (<= 100 lines).");
for (const marker of [
  "docs/README.md",
  "harness/GOAL.template.md",
  "npm run verify:agent",
  "harness/agent-state/progress.md",
  "docs/OPEN_QUESTIONS.md",
]) {
  assert(agents.includes(marker), `AGENTS.md is missing required pointer: ${marker}`);
}

const goal = read("harness/GOAL.template.md");
for (const heading of [
  "## Objective",
  "## Visible result",
  "## Relevant context",
  "## Acceptance criteria",
  "## Allowed files / domains",
  "## Forbidden areas",
  "## Mandatory tests",
  "## Required evidence",
  "## Definition of done",
]) {
  assert(goal.includes(heading), `GOAL template is missing: ${heading}`);
}

const registry = JSON.parse(read("harness/feature_list.json"));
const expectedStatuses = ["planned", "in_progress", "blocked", "done"];
assert(registry.schema_version === 1, "feature_list schema_version must be 1.");
assert(Array.isArray(registry.allowed_statuses), "feature_list.allowed_statuses must be an array.");
for (const status of expectedStatuses) {
  assert(registry.allowed_statuses.includes(status), `Missing allowed status: ${status}`);
}
assert(Array.isArray(registry.features), "feature_list.features must be an array.");

const ids = new Set();
for (const feature of registry.features) {
  assert(
    typeof feature.id === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(feature.id),
    "Feature id must be kebab-case.",
  );
  assert(!ids.has(feature.id), `Duplicate feature id: ${feature.id}`);
  ids.add(feature.id);
  assert(
    typeof feature.title === "string" && feature.title.length > 0,
    `Missing title: ${feature.id}`,
  );
  assert(expectedStatuses.includes(feature.status), `Invalid status: ${feature.id}`);
  assert(typeof feature.verified === "boolean", `verified must be boolean: ${feature.id}`);
  assert(Array.isArray(feature.dependencies), `dependencies must be array: ${feature.id}`);
  assert(Array.isArray(feature.evidence), `evidence must be array: ${feature.id}`);
  assert(
    typeof feature.updated_at === "string" && !Number.isNaN(Date.parse(feature.updated_at)),
    `updated_at must be ISO date: ${feature.id}`,
  );

  if (feature.status === "done") {
    assert(feature.verified === true, `Done feature must be verified: ${feature.id}`);
    assert(feature.evidence.length > 0, `Done feature must have evidence: ${feature.id}`);
  }
  if (feature.verified) {
    assert(feature.status === "done", `Verified feature must be done: ${feature.id}`);
  }
}

const evals = read("harness/evals/behavioral.md");
for (const phrase of [
  "Consulted required documentation?",
  "Modified files outside scope?",
  "Duplicated component?",
  "Ignored failing test?",
  "Altered UI without screenshot?",
  "Changed database without migration?",
  "Changed RLS without test?",
  "Left secret?",
  "Declared success without verify?",
  "Git state matches report?",
  "Repeated failure without ratchet?",
]) {
  assert(evals.includes(phrase), `Behavioral eval missing: ${phrase}`);
}

run(process.execPath, ["scripts/verify-ratchet.mjs"]);
run(process.execPath, ["scripts/verify-engineering-system.mjs"]);
run(process.execPath, ["scripts/verify-platform.mjs"]);

success(
  `Harness contract valid: ${requiredPaths.length} required paths, ${registry.features.length} registry entries.`,
);
