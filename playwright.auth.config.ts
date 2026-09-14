import { defineConfig, devices } from "@playwright/test";
import { authTestEnv } from "./tests/e2e/support/auth";

// Deliberately connects to an existing server: no webServer, migrations, or seed.
export default defineConfig({
  testDir: "./tests/e2e/auth",
  globalSetup: "./tests/e2e/auth/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  forbidOnly: true,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: authTestEnv.E2E_BASE_URL,
    storageState: { cookies: [], origins: [] },
    trace: "off",
    screenshot: "off",
    video: "off",
  },
});
