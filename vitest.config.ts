import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getTsconfigPaths() {
  const tsconfigPath = path.resolve(__dirname, "tsconfig.json");
  const tsconfigContent = fs.readFileSync(tsconfigPath, "utf-8");
  const tsconfig = JSON.parse(tsconfigContent.replace(/\/\/.*$/gm, ""));

  const aliases: Record<string, string> = {};
  const paths = tsconfig.compilerOptions?.paths || {};

  for (const [alias, targets] of Object.entries(paths)) {
    const target = Array.isArray(targets) ? targets[0] : targets;
    const cleanAlias = alias.replace("/*", "");
    const cleanTarget = target.replace("/*", "");
    aliases[cleanAlias] = path.resolve(__dirname, cleanTarget);
  }

  return aliases;
}

export default defineConfig({
  resolve: {
    alias: getTsconfigPaths(),
  },
  test: {
    globals: true,
    environment: "node",
    silent: true,
    logHeapUsage: false,
    env: {
      NODE_ENV: "test",
      ANTHROPIC_API_KEY: "test",
      AUTH_USERNAME: "test",
      AUTH_PASSWORD: "test",
      DATABASE_URL: "postgresql://localhost:5432/fitness_test",
    },
    exclude: [
      "**/node_modules/**",
      ".direnv/**",
      "tests/e2e/**",
      "**/*.integration.test.*",
    ],
  },
});
