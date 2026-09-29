import { defineConfig, devices } from "@playwright/test";
import { authTestEnv, credentials } from "./tests/e2e/support/auth";

const authFile = "playwright/.auth/user.json";

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: process.env.CI ? undefined : "./tests/e2e/auth/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  timeout: 15_000,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["list"], ["html"]] : "html",
  use: {
    baseURL: authTestEnv.E2E_BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "auth",
      dependencies: ["setup"],
      testMatch:
        /auth\/(browser-session|protected-routes|mutation-boundary|oauth|storage)\.spec\.ts$/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: { cookies: [], origins: [] },
        trace: "off",
        screenshot: "off",
        video: "off",
      },
      fullyParallel: false,
    },
    {
      name: "chromium",
      dependencies: ["setup"],
      testIgnore: [/auth\.setup\.ts/, /auth\/.*\.spec\.ts/],
      use: {
        ...devices["Desktop Chrome"],
        storageState: authFile,
      },
    },
  ],
  webServer: process.env.CI
    ? {
        command: "bun run start",
        url: authTestEnv.E2E_BASE_URL,
        reuseExistingServer: false,
        env: {
          AUTH_USERNAME: credentials.username,
          AUTH_PASSWORD: credentials.password,
          HOST: "127.0.0.1",
          PORT: String(authTestEnv.TEST_PORT),
          DATABASE_URL:
            process.env.DATABASE_URL || "postgresql://localhost/fitness",
          ANTHROPIC_API_KEY: "test-key",
        },
      }
    : undefined,
});
