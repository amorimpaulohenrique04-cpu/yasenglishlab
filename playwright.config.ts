import { defineConfig, devices } from "@playwright/test";

const port = process.env.PLAYWRIGHT_PORT ?? "3000";
const baseURL = `http://127.0.0.1:${port}`;

// The local billing provider deliberately refuses production. Keep its journey on
// a separate development origin; every other E2E still uses the production build.
const separateCommercial =
  process.env.CANONICAL_E2E === "1" && process.env.YAS_E2E_PRODUCTION === "1";
const commercialPort = String(Number(port) + 1);
const commercialURL = `http://127.0.0.1:${commercialPort}`;
const server = {
  command: `"${process.execPath}" tests/helpers/start-core-e2e-server.mjs`,
  url: baseURL,
  reuseExistingServer: !process.env.CI && process.env.YAS_ISOLATED_VERIFY !== "1",
  timeout: 120_000,
};

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
      testIgnore: "commercial.spec.ts",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium-commercial",
      testMatch: "commercial.spec.ts",
      use: { ...devices["Desktop Chrome"], baseURL: separateCommercial ? commercialURL : baseURL },
    },
  ],
  webServer: separateCommercial
    ? [
        server,
        {
          ...server,
          url: commercialURL,
          reuseExistingServer: false,
          env: {
            PLAYWRIGHT_PORT: commercialPort,
            APP_URL: commercialURL,
            YAS_E2E_PRODUCTION: "0",
            YAS_ISOLATED_VERIFY: "1",
          },
        },
      ]
    : server,
});
