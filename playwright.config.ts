import { defineConfig, devices } from "@playwright/test";

const port = process.env.PLAYWRIGHT_PORT ?? "3000";
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: [
    [process.env.CI ? "github" : "list"],
    ["json", { outputFile: "artifacts/e2e/results.json" }],
  ],
  use: {
    baseURL,
    trace: "retain-on-failure",
    // Same as the a11y/visual/golden configs: axe must not scan a tab or button mid-transition.
    reducedMotion: "reduce",
    actionTimeout: 10_000,
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `"${process.execPath}" tests/helpers/start-core-e2e-server.mjs`,
    url: baseURL,
    reuseExistingServer: !process.env.CI && process.env.YAS_ISOLATED_VERIFY !== "1",
    timeout: 120_000,
  },
});
