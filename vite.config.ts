import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
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
  },
  resolve: {
    alias: {
      "cloudflare:sockets": "node:crypto",
    },
  },
});
