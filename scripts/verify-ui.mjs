import { assert, exists, run, success } from "./_verify-utils.mjs";

const screens = ["login", "home", "aulas", "pratica", "materiais", "progresso", "agenda", "perfil"];

for (const screen of screens) {
  assert(exists(`docs/reference-ui/${screen}/reference.webp`), `Missing approved UI reference: ${screen}`);
}
assert(exists(".storybook/main.ts"), "Missing Storybook configuration.");
assert(exists("tests/e2e/foundation.spec.ts"), "Missing E2E foundation.");

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
run(npm, ["run", "storybook:build"]);
run(npm, ["run", "test:e2e"]);

success(`UI verification passed with ${screens.length} approved reference screens, Storybook build and Playwright E2E.`);
