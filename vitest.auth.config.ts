import { defineConfig } from "vitest/config";
import base from "./vitest.config";

export default defineConfig({
  ...base,
  test: {
    ...base.test,
    env: {},
    include: ["app/modules/auth/**/*.integration.test.ts"],
    exclude: [
      "node_modules/**",
      "app/modules/auth/infra/account-settings.integration.test.ts",
    ],
    fileParallelism: false,
    // Polls wait on spawned auth processes, whose startup depends on load.
    expect: { poll: { timeout: 20_000 } },
  },
});
