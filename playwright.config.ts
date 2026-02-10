import { defineConfig, devices } from "@playwright/test";

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: "html",
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: "http://localhost:5175",

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: "on-first-retry",
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command:
      "bun run build && bun run db:migrate && bun run db:seed && bun run start",
    url: "http://localhost:5175",
    reuseExistingServer: !process.env.CI,
    env: {
      AUTH_USERNAME: "testuser",
      AUTH_PASSWORD: "testpassword",
      HOST: "127.0.0.1",
      PORT: "5175",
      // These should be updated to point to a test database in a real CI environment
      DATABASE_URL:
        process.env.DATABASE_URL || "postgresql://localhost/fitness",
      ANTHROPIC_API_KEY: "test-key",
    },
  },
});
