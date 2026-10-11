import { defineConfig } from "@playwright/test";
import { hermeticLaunchOptions } from "./tests/hermetic-browser";

export default defineConfig({
  testDir: "./tests/browser",
  testMatch: /\.browser\.ts$/,
  timeout: 15_000,
  retries: 0,
  reporter: "list",
  use: {
    launchOptions: hermeticLaunchOptions,
    browserName: "chromium",
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  },
});
