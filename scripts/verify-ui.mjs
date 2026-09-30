import { assert, exists, run, success } from "./_verify-utils.mjs";

const screens = ["login", "home", "aulas", "pratica", "materiais", "progresso", "agenda", "perfil"];

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

for (const viewport of ["desktop", "tablet", "mobile"]) {
  for (const screen of ["login", "home", "aulas"]) {
    assert(
      exists(`tests/visual/goldens/${viewport}/${screen}.png`),
      `Missing golden baseline: ${viewport}/${screen}.png`,
    );
  }
}

const npm = process.platform === "win32" ? "npm.cmd" : "npm";

run(npm, ["run", "storybook:build"]);
run(npm, ["run", "test:e2e"]);
run(npm, ["run", "test:a11y"]);
run(npm, ["run", "test:visual:storybook"]);
run(npm, ["run", "test:visual:golden"]);

success(
  `UI verification passed with ${screens.length} approved references, 9 product goldens, E2E, accessibility, Storybook and visual regression checks.`,
);
