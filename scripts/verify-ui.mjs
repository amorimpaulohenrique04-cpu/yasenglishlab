import { assert, exists, run, runNpm, success } from "./_verify-utils.mjs";

const screens = ["login", "home", "aulas", "pratica", "materiais", "progresso", "agenda", "perfil"];
const canonicalE2e = process.env.CANONICAL_E2E === "1";

function prepareCanonicalFixture() {
  run(process.execPath, ["scripts/setup-canonical-e2e.mjs"]);
}

for (const screen of screens) {
  assert(
    exists(`docs/reference-ui/${screen}/reference.webp`),
    `Missing approved UI reference: ${screen}`,
  );
}

assert(exists(".storybook/main.ts"), "Missing Storybook configuration.");
assert(exists("tests/e2e/foundation.spec.ts"), "Missing E2E foundation.");
assert(
  exists("tests/e2e/canonical-slice.spec.ts"),
  "Missing canonical learning vertical-slice E2E.",
);
assert(exists("tests/visual/design-system.spec.ts"), "Missing design-system visual/a11y suite.");
assert(exists("tests/a11y/critical-flows.spec.ts"), "Missing critical-flow accessibility suite.");
assert(exists("playwright.a11y.config.ts"), "Missing accessibility Playwright config.");
assert(exists("tests/visual/golden.spec.ts"), "Missing product golden visual suite.");
assert(exists("playwright.golden.config.ts"), "Missing golden Playwright config.");

for (const platform of ["linux", "win32"]) {
  for (const viewport of ["desktop", "tablet", "mobile"]) {
    for (const screen of ["login", "home", "aulas"]) {
      assert(
        exists(`tests/visual/goldens/${viewport}/${screen}-${platform}.png`),
        `Missing golden baseline: ${viewport}/${screen}-${platform}.png`,
      );
    }
  }
}

runNpm(["run", "storybook:build"]);
if (canonicalE2e) prepareCanonicalFixture();
runNpm(["run", "test:e2e"]);
if (canonicalE2e) prepareCanonicalFixture();
runNpm(["run", "test:a11y"]);
runNpm(["run", "test:visual:storybook"]);
if (canonicalE2e) prepareCanonicalFixture();
runNpm(["run", "test:visual:golden"]);

success(
  `UI verification passed with ${screens.length} approved references, 18 platform-specific product goldens, E2E, accessibility, Storybook and visual regression checks.`,
);
