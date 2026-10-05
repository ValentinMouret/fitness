import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { designPreviewBuild } from "./design-preview.config";

export default defineConfig({
  envDir: designPreviewBuild ? false : undefined,
  plugins: [reactRouter(), tsconfigPaths()],
  server: {
    port: Number(process.env.PORT) || 5173,
  },
  environments: {
    client: {
      build: { sourcemap: false },
    },
    ssr: {
      build: { sourcemap: true },
    },
  },
  define: {
    global: "globalThis",
    "import.meta.env.FITNESS_DESIGN_PREVIEW":
      JSON.stringify(designPreviewBuild),
    "import.meta.env.FITNESS_PREVIEW_REVISION": JSON.stringify(
      process.env.GIT_SHA ?? "unknown",
    ),
  },
  resolve: {
    alias: {
      "cloudflare:sockets": "node:crypto",
    },
  },
});
