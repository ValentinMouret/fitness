import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  testMatch: /\.browser\.ts$/,
  timeout: 15_000,
  retries: 0,
  reporter: "list",
  use: {
    browserName: "chromium",
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  },
});
