import "dotenv/config";
import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { env } from "./app/env.server";

export default defineConfig({
  plugins: [reactRouter(), tsconfigPaths()],
  server: {
    port: env.PORT,
  },
  build: {
    sourcemap: true,
  },
  define: {
    global: "globalThis",
  },
  resolve: {
    alias: {
      "cloudflare:sockets": "node:crypto",
    },
  },
});
