import { defineConfig } from "@playwright/test";

const port = process.env.PLAYWRIGHT_PORT ?? "3000";
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/a11y",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI
    ? [["github"], ["json", { outputFile: "artifacts/a11y/results.json" }]]
    : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    reducedMotion: "reduce",
  },
  projects: [
    { name: "desktop-a11y", use: { viewport: { width: 1440, height: 900 } } },
    { name: "mobile-a11y", use: { viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command: `"${process.execPath}" node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port ${port}`,
    url: `${baseURL}/login`,
    reuseExistingServer: !process.env.CI && process.env.YAS_ISOLATED_VERIFY !== "1",
    timeout: 120_000,
  },
});
