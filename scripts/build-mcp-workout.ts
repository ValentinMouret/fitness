import { mkdir, readFile, writeFile } from "node:fs/promises";
import { build } from "vite";

const result = await build({
  configFile: false,
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  esbuild: { jsx: "automatic", jsxDev: false },
  resolve: { alias: { "~": new URL("../app", import.meta.url).pathname } },
  build: {
    write: false,
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    minify: true,
    lib: {
      entry: "app/modules/mcp/presentation/workout-app.client.tsx",
      formats: ["iife"],
      name: "FitnessWorkout",
    },
  },
});
const outputs = Array.isArray(result) ? result : [result];
let script = "";
let css = "";
for (const bundle of outputs) {
  if (!("output" in bundle)) throw new Error("MCP workout bundle missing");
  for (const item of bundle.output) {
    if (item.type === "chunk") script += item.code;
    else if (item.fileName.endsWith(".css")) css += item.source;
  }
}
if (!script || !css) throw new Error("Incomplete MCP workout bundle");
const fontLicenses = await Promise.all(
  ["crimsonpro-OFL.txt", "dmsans-OFL.txt"].map((name) =>
    readFile(`app/modules/mcp/presentation/fonts/${name}`, "utf8"),
  ),
);
await mkdir("build", { recursive: true });
await writeFile(
  "build/mcp-workout.html",
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fitness workout</title><!-- Embedded font licenses:\n${fontLicenses.join("\n")} --><style>${css.replaceAll("</style", "<\\/style")}</style></head><body><div id="root"></div><script>${script.replaceAll("</script", "<\\/script")}</script></body></html>`,
);
