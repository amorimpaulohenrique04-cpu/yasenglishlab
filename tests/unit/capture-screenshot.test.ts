import { readFile, writeFile } from "node:fs/promises";
import { expect, it, vi } from "vitest";
import type { Page } from "@playwright/test";
import { captureScreenshot } from "../helpers/capture-screenshot";

vi.mock("node:fs/promises", async (original) => {
  const fs = await original<typeof import("node:fs/promises")>();
  return { ...fs, writeFile: vi.fn(fs.writeFile) };
});

it("writes unique runtime captures without touching historical evidence", async () => {
  const bytes = Buffer.from("screenshot fixture");
  const page = { screenshot: vi.fn().mockResolvedValue(bytes) } as unknown as Page;
  const info = { outputPath: () => "same-test-output", attach: vi.fn() };
  const first = await captureScreenshot(page, info, "desktop", { fullPage: true });
  const second = await captureScreenshot(page, info, "desktop", { fullPage: true });
  expect(first).not.toBe(second);
  expect(first.replaceAll("\\", "/")).toContain("/artifacts/e2e/captures/");
  expect(await readFile(first)).toEqual(bytes);
  expect(info.attach).toHaveBeenCalledTimes(2);
  expect(page.screenshot).toHaveBeenCalledWith({ fullPage: true });
});

it("preserves capture errors instead of converting a failed capture into success", async () => {
  const error = new Error("controlled screenshot failure");
  const page = { screenshot: vi.fn().mockRejectedValue(error) } as unknown as Page;
  const info = { outputPath: () => "failing-test-output", attach: vi.fn() };
  await expect(captureScreenshot(page, info, "desktop", { fullPage: true })).rejects.toBe(error);
  expect(info.attach).not.toHaveBeenCalled();
});

it("fails visibly when the runtime destination cannot be written", async () => {
  const error = Object.assign(new Error("controlled open failure"), { code: "UNKNOWN" });
  vi.mocked(writeFile).mockRejectedValueOnce(error);
  const page = { screenshot: vi.fn().mockResolvedValue(Buffer.from("png")) } as unknown as Page;
  const info = { outputPath: () => "write-failure-output", attach: vi.fn() };
  await expect(captureScreenshot(page, info, "desktop", { fullPage: true })).rejects.toBe(error);
  expect(info.attach).not.toHaveBeenCalled();
});
