import { defineConfig, devices } from "@playwright/test";
import { authTestEnv } from "./tests/e2e/support/auth";
import { hermeticLaunchOptions } from "./tests/hermetic-browser";

const authFile = "playwright/.auth/user.json";

export default defineConfig({
  testDir: "./tests/e2e",
  // The same settings apply everywhere; `bun run gate` starts the server.
  globalSetup: "./tests/e2e/auth/global-setup.ts",
  fullyParallel: true,
  forbidOnly: process.env.GATE === "1",
  timeout: 15_000,
  retries: 1,
  // A test that passes only on retry is flaky, and flaky fails the gate.
  failOnFlakyTests: true,
  workers: 4,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    launchOptions: hermeticLaunchOptions,
    baseURL: authTestEnv.E2E_BASE_URL,
    // Exit animations keep closing menus and dialogs mounted and listening,
    // so timing under load decides whether the next tap lands.
    contextOptions: { reducedMotion: "reduce" },
    // Keep the first failure's evidence; a retry may not reproduce it.
    trace: "retain-on-failure",
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
        // Gate credentials and OAuth clients are fixtures, so failure traces are safe.
        trace: "retain-on-failure",
        screenshot: "off",
        video: "off",
      },
      fullyParallel: false,
    },
    {
      name: "chromium",
      dependencies: ["setup"],
      testIgnore: [
        /auth\.setup\.ts/,
        /auth\/.*\.spec\.ts/,
        /(?:device-timezone|device-day|workout-date-hydration)\.spec\.ts/,
        /native\/.*\.spec\.ts/,
      ],
      use: {
        ...devices["Desktop Chrome"],
        storageState: authFile,
      },
    },
    {
      name: "device-timezone",
      dependencies: ["auth", "chromium"],
      testMatch:
        /(?:device-timezone|device-day|workout-date-hydration)\.spec\.ts/,
      fullyParallel: false,
      workers: 1,
      use: {
        ...devices["Desktop Chrome"],
        storageState: authFile,
      },
    },
  ],
});
