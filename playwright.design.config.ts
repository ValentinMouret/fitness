import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/design-preview",
  testMatch: /\.browser\.ts$/,
  fullyParallel: true,
  retries: 0,
  reporter: "list",
  use: { baseURL: process.env.DESIGN_PREVIEW_URL ?? "http://127.0.0.1:5201" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
});
