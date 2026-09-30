import { assert, exists, read, success } from "./_verify-utils.mjs";

const requiredPaths = [
  "docs/PRODUCT.md",
  "docs/ARCHITECTURE.md",
  "docs/UI_CONTRACT.md",
  "docs/DATA_MODEL.md",
  "docs/SECURITY.md",
  "docs/AUTH_RBAC_RLS.md",
  "docs/THREAT_MODEL.md",
  "docs/TESTING.md",
  "docs/OPERATIONS.md",
  "docs/CI_CD.md",
  "docs/OBSERVABILITY.md",
  "docs/ANALYTICS.md",
  "docs/AUDIT_LOG.md",
  "AGENTS.md",
  "harness/GOAL.template.md",
  "harness/feature_list.json",
  "harness/evals/behavioral.md",
  "harness/ratchet.md",
  "src/styles/tokens.css",
  "src/styles/tokens.ts",
  "src/components/ui/index.ts",
  "src/components/layout/index.ts",
  "src/modules/learning/application/ports.ts",
  "src/server/learning/canonical-slice.ts",
  "supabase/tests/rls_permissions.sql",
  "tests/e2e/canonical-slice.spec.ts",
  "tests/a11y/critical-flows.spec.ts",
  "tests/visual/golden.spec.ts",
  ".github/workflows/foundation-verify.yml",
  ".github/workflows/release.yml",
];

for (const path of requiredPaths) {
  assert(exists(path), `Engineering System 1.0 path missing: ${path}`);
}

function uiVerifierErrors(source) {
  const requiredScripts = [
    "storybook:build",
    "test:e2e",
    "test:a11y",
    "test:visual:storybook",
    "test:visual:golden",
  ];

  return requiredScripts
    .filter((script) => !source.includes(`["run", "${script}"]`))
    .map((script) => `verify:ui is missing ${script}`);
}

function staleStateErrors(plan, registry) {
  const errors = [];
  const activeTask = plan.match(/## Active task\s+\*\*([^*]+)\*\*/)?.[1]?.trim();
  if (!activeTask) return errors;

  const feature = registry.features.find((entry) => entry.id === activeTask);
  if (!feature) {
    errors.push(`active task is missing from feature registry: ${activeTask}`);
    return errors;
  }

  const stateLine = plan.match(/^State:\s*(.+)$/im)?.[1] ?? "";
  if (
    feature.status === "done" &&
    /(pending|in[_ -]?progress|merge pending|verification pending)/i.test(stateLine)
  ) {
    errors.push(`completed feature has stale active-plan state: ${activeTask}`);
  }

  return errors;
}

function staleReadmeErrors(source) {
  const forbidden = [
    "engineering foundation only",
    "The placeholder app",
    "future design-system task",
    "No dashboard, plan logic, Stripe integration or product database schema exists yet",
    "Full CI/CD policy is intentionally deferred",
  ];

  return forbidden
    .filter((phrase) => source.includes(phrase))
    .map((phrase) => `README contains stale statement: ${phrase}`);
}

const controlledBadUi =
  'run(npm, ["run", "test:e2e"]); run(npm, ["run", "test:visual:storybook"]);';
const controlledGoodUi =
  'run(npm, ["run", "storybook:build"]); run(npm, ["run", "test:e2e"]); run(npm, ["run", "test:a11y"]); run(npm, ["run", "test:visual:storybook"]); run(npm, ["run", "test:visual:golden"]);';

assert(
  uiVerifierErrors(controlledBadUi).some((error) => error.includes("test:a11y")) &&
    uiVerifierErrors(controlledBadUi).some((error) => error.includes("test:visual:golden")),
  "Controlled incomplete UI verifier was not rejected.",
);
assert(uiVerifierErrors(controlledGoodUi).length === 0, "Controlled complete UI verifier failed.");

const controlledRegistry = {
  features: [{ id: "done-task", status: "done" }],
};
const controlledBadPlan =
  "# Agent Plan\\n\\n## Active task\\n\\n**done-task**\\n\\nState: merge pending.";
const controlledGoodPlan = "# Agent Plan\n\n## Active task\n\n**done-task**\n\nState: complete.";
assert(
  staleStateErrors(controlledBadPlan, controlledRegistry).length > 0,
  "Controlled stale harness state was not rejected.",
);
assert(
  staleStateErrors(controlledGoodPlan, controlledRegistry).length === 0,
  "Controlled consistent harness state failed.",
);

const uiVerifier = read("scripts/verify-ui.mjs");
const uiErrors = uiVerifierErrors(uiVerifier);
assert(uiErrors.length === 0, uiErrors.join("\n"));

const readme = read("README.md");
const readmeErrors = staleReadmeErrors(readme);
assert(readmeErrors.length === 0, readmeErrors.join("\n"));
for (const marker of [
  "Yas Engineering System 1.0",
  "canonical learning vertical slice",
  "npm run verify:full",
]) {
  assert(readme.includes(marker), `README is missing current-system marker: ${marker}`);
}

const stylesReadme = read("src/styles/README.md");
assert(
  stylesReadme.includes("tokens.css"),
  "Styles README must point to executable design tokens.",
);
assert(
  !stylesReadme.includes("intentionally deferred"),
  "Styles README still claims design tokens are deferred.",
);

const modulesReadme = read("src/modules/README.md");
for (const marker of ["domain/", "auth/", "learning/", "application/"]) {
  assert(
    modulesReadme.includes(marker),
    `Modules README missing current implementation: ${marker}`,
  );
}
assert(
  !modulesReadme.includes("PROMPT 05 adds contracts"),
  "Modules README still describes the pre-vertical-slice state.",
);

const pkg = JSON.parse(read("package.json"));
for (const script of [
  "verify:system",
  "verify:ui",
  "verify:security",
  "verify:db",
  "verify:full",
  "test:a11y",
  "test:visual:storybook",
  "test:visual:golden",
]) {
  assert(typeof pkg.scripts?.[script] === "string", `Missing package script: ${script}`);
}

const ci = read(".github/workflows/foundation-verify.yml");
for (const marker of [
  "CI Gate",
  "Harness invariants",
  "Security invariants",
  "Validate migrations from a clean database",
  "Prove intentional error reaches observability",
  "Accessibility checks",
  "Product golden visual checks",
]) {
  assert(ci.includes(marker), `Official CI missing gate: ${marker}`);
}

const release = read(".github/workflows/release.yml");
for (const marker of ["Release Gate", "name: Staging", "name: Production"]) {
  assert(release.includes(marker), `Release workflow missing stage: ${marker}`);
}

const registry = JSON.parse(read("harness/feature_list.json"));
const requiredMilestones = [
  "prompt-02-engineering-foundation",
  "prompt-03-harness-engineering",
  "prompt-04-design-system",
  "prompt-05-domain-model",
  "prompt-06-auth-rbac-rls",
  "prompt-07-canonical-vertical-slice",
  "prompt-08-testing-evals",
  "prompt-09-ci-cd",
  "prompt-10-observability",
  "prompt-11-ratchet-adrs",
  "prompt-12-engineering-system-1-0",
];

const ids = new Set(registry.features.map((feature) => feature.id));
for (const id of requiredMilestones) {
  assert(ids.has(id), `Feature registry is missing engineering milestone: ${id}`);
}

for (const feature of registry.features) {
  for (const dependency of feature.dependencies) {
    assert(ids.has(dependency), `Unresolved feature dependency: ${feature.id} -> ${dependency}`);
  }
}

const plan = read("harness/agent-state/plan.md");
const planErrors = staleStateErrors(plan, registry);
assert(planErrors.length === 0, planErrors.join("\n"));

for (const viewport of ["desktop", "tablet", "mobile"]) {
  for (const screen of ["login", "home", "aulas"]) {
    assert(
      exists(`tests/visual/goldens/${viewport}/${screen}.png`),
      `Engineering System golden missing: ${viewport}/${screen}.png`,
    );
  }
}

success(
  "Engineering System 1.0 contract valid: docs, Harness state, registry, UI gates, RLS, CI/CD, observability and Ratchet surfaces are internally consistent.",
);
