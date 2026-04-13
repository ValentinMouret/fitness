import { defineConfig, devices } from "@playwright/test";

const authFile = "playwright/.auth/user.json";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  timeout: 15_000,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["list"], ["html"]] : "html",
  use: {
    baseURL: "http://127.0.0.1:5175",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "chromium",
      dependencies: ["setup"],
      testIgnore: /auth\.setup\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: authFile,
      },
    },
  ],
  webServer: {
    command: process.env.CI
      ? "bun run start"
      : "bun run build && bun run db:migrate && bun run db:seed && bun run start",
    url: "http://127.0.0.1:5175",
    reuseExistingServer: !process.env.CI,
    env: {
      AUTH_USERNAME: "testuser",
      AUTH_PASSWORD: "testpassword",
      HOST: "127.0.0.1",
      PORT: "5175",
      DATABASE_URL:
        process.env.DATABASE_URL || "postgresql://localhost/fitness",
      ANTHROPIC_API_KEY: "test-key",
    },
  },
});
