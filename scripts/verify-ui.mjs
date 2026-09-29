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
assert(exists("tests/visual/design-system.spec.ts"), "Missing design-system visual/a11y suite.");

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
run(npm, ["run", "storybook:build"]);
run(npm, ["run", "test:e2e"]);
run(npm, ["run", "test:visual"]);

success(
  `UI verification passed with ${screens.length} approved references, Storybook, app E2E and design-system axe/visual checks.`,
);
