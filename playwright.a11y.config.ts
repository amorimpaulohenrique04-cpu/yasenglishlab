import { defineConfig } from "@playwright/test";

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
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
    reducedMotion: "reduce",
  },
  projects: [
    { name: "desktop-a11y", use: { viewport: { width: 1440, height: 900 } } },
    { name: "mobile-a11y", use: { viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1",
    url: "http://127.0.0.1:3000/login",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
