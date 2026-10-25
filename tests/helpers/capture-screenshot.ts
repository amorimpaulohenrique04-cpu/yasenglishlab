import { createHash } from "node:crypto";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Page, TestInfo } from "@playwright/test";

/** Runtime captures never overwrite reviewed evidence. Promote selected files after review. */
export async function captureScreenshot(
  page: Page,
  info: Pick<TestInfo, "outputPath" | "attach">,
  name: string,
  options: { fullPage: boolean },
) {
  const run = createHash("sha256").update(info.outputPath("captures")).digest("hex").slice(0, 16);
  const root = resolve("artifacts/e2e/captures");
  await mkdir(root, { recursive: true });
  const folder = await mkdtemp(resolve(root, `${run}-`));
  const filename = `${name.replace(/[^a-z0-9_-]/gi, "-")}.png`;
  const path = resolve(folder, filename);
  const bytes = await page.screenshot(options);
  await writeFile(path, bytes, { flag: "wx" });
  await info.attach(name, { path, contentType: "image/png" });
  return path;
}
