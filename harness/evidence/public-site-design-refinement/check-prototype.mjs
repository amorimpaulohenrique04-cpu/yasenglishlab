import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { Script } from "node:vm";
import * as prettier from "prettier";

const file = resolve("artifacts/public-site-proposal/index.html");
const html = readFileSync(file, "utf8");
const css = readFileSync(resolve(dirname(file), "refinement.css"), "utf8");
await prettier.format(html, { parser: "html" });
await prettier.format(css, { parser: "css" });
let scripts = 0;
for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) {
  new Script(match[1]);
  scripts++;
}
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
if (new Set(ids).size !== ids.length) throw new Error("Duplicate static IDs");
let assets = 0;
for (const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
  const target = match[1];
  if (/^(https?:|data:)/.test(target) || target.includes("${")) continue;
  if (!existsSync(resolve(dirname(file), target))) {
    throw new Error(`Missing local asset: ${target}`);
  }
  assets++;
}
console.log(
  `PASS: HTML/CSS parsed; ${scripts} inline script compiled; ${ids.length} unique static IDs; ${assets} local asset references resolved.`,
);
console.log(
  "LIMIT: static inspection only; browser, responsive layout and flow execution remain unverified.",
);
