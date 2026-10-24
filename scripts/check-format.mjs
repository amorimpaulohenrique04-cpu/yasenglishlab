import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import * as prettier from "prettier";

// Format is a repository gate: local tools, screenshots and untracked downloads
// must neither slow it down nor require rewriting files outside the change.
const listed = spawnSync("git", ["ls-files", "-z"], { encoding: "utf8" });
if (listed.status !== 0) throw new Error("Cannot establish tracked formatting scope.");
// Tracked files deleted in the working tree have nothing left to format.
const files = listed.stdout.split("\0").filter((filepath) => filepath && existsSync(filepath));
const failed = [];
let checked = 0;
for (let offset = 0; offset < files.length; offset += 16) {
  await Promise.all(
    files.slice(offset, offset + 16).map(async (filepath) => {
      const info = await prettier.getFileInfo(filepath, {
        ignorePath: [".gitignore", ".prettierignore"],
      });
      if (info.ignored || !info.inferredParser) return;
      const config = await prettier.resolveConfig(filepath);
      checked++;
      try {
        if (!(await prettier.check(readFileSync(filepath, "utf8"), { ...config, filepath })))
          failed.push(filepath);
      } catch (error) {
        failed.push(`${filepath}: ${error.message}`);
      }
    }),
  );
}
if (failed.length) {
  console.error(`Formatting failed:\n${failed.sort().join("\n")}`);
  process.exitCode = 1;
} else console.log(`Formatting passed: ${checked} tracked source files.`);
