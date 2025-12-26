import { defineConfig } from "vitest/config";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

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
    setupFiles: ["./vitest.setup.ts"],
  },
});
