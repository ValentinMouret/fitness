import { defineConfig, devices } from "@playwright/test";
import { z } from "zod";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: [/native\/.*\.spec\.ts$/, /auth-foundation\.spec\.ts$/],
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  forbidOnly: true,
  retries: 0,
  reporter: [["list"]],
  use: {
    ...devices["Desktop Chrome"],
    viewport: { width: 390, height: 844 },
    baseURL: z.url().parse(process.env.E2E_BASE_URL),
    storageState: { cookies: [], origins: [] },
    trace: "off",
    screenshot: "off",
    video: "off",
  },
});
