import { env } from "~/env.server";

export function oauthConfig() {
  if (!env.OAUTH_ISSUER_URL) throw new Response("Not found", { status: 404 });
  return {
    issuer: env.OAUTH_ISSUER_URL,
    resource: `${env.OAUTH_ISSUER_URL}/mcp`,
    clients: env.OAUTH_CLIENTS,
  };
}
