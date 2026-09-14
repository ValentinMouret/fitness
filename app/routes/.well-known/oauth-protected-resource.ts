import { oauthConfig } from "~/modules/auth/infra/oauth-config.server";

export function loader() {
  const { issuer, resource } = oauthConfig();
  return Response.json({
    resource,
    authorization_servers: [issuer],
    scopes_supported: ["fitness"],
    bearer_methods_supported: ["header"],
  });
}
