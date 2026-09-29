import { readFileSync } from "node:fs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const preview = readFileSync(".github/workflows/preview.yml", "utf8");
const staging = readFileSync(".github/workflows/deploy-staging.yml", "utf8");
const production = readFileSync(".github/workflows/deploy-production.yml", "utf8");

assert(
  preview.includes("name: preview"),
  "Preview workflow must use the preview GitHub Environment.",
);
assert(
  staging.includes("name: staging"),
  "Staging workflow must use the staging GitHub Environment.",
);
assert(
  production.includes("name: production"),
  "Production workflow must use the production GitHub Environment.",
);

assert(
  !/PRODUCTION_[A-Z0-9_]+/.test(preview),
  "Preview workflow must not reference production-prefixed secrets or variables.",
);
assert(
  !preview.includes("YAS_ENVIRONMENT: production"),
  "Preview workflow must never target production.",
);
assert(
  staging.includes("YAS_ENVIRONMENT: staging"),
  "Staging deployment must identify itself as staging.",
);
assert(
  production.includes("YAS_ENVIRONMENT: production"),
  "Production deployment must identify itself as production.",
);

for (const [name, workflow] of [
  ["preview", preview],
  ["staging", staging],
  ["production", production],
]) {
  assert(
    workflow.includes("permissions:\n  contents: read"),
    name + " workflow must default to read-only repository contents.",
  );
  assert(
    !/permissions:[\s\S]{0,200}\bcontents:\s*write\b/.test(workflow),
    name + " workflow must not request contents: write.",
  );
}

assert(
  production.includes("npm run ci:release-gate"),
  "Production workflow must execute the release gate.",
);
assert(
  production.includes("supabase db push --dry-run") && production.includes("supabase db push"),
  "Production workflow must dry-run then apply versioned migrations.",
);
assert(
  staging.includes("supabase db push --dry-run") && staging.includes("supabase db push"),
  "Staging workflow must dry-run then apply versioned migrations.",
);
assert(
  preview.includes("github.event.workflow_run.conclusion == 'success'"),
  "Preview workflow must depend on green CI.",
);
assert(
  staging.includes("github.event.workflow_run.conclusion == 'success'"),
  "Staging workflow must depend on green CI.",
);

console.log("✓ Environment isolation contract passed.");
