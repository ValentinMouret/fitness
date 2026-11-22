import type { Config } from "@react-router/dev/config";

// Cloudflare terminates TLS, so the server sees http:// while browsers send an
// https:// Origin. Allow only the public host past React Router's CSRF check.
export const allowedActionOrigins = ["fitness.valentinmouret.io"] as const;

export default {
  ssr: true,
  routeDiscovery: { mode: "initial" },
  future: { v8_middleware: true },
  allowedActionOrigins: [...allowedActionOrigins],
} satisfies Config;
