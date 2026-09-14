import { exchangeToken } from "~/modules/auth/infra/oauth.repository.server";
import { oauthConfig } from "~/modules/auth/infra/oauth-config.server";
import {
  authenticateClient,
  oauthError,
  privateHeaders,
  readOAuthForm,
} from "~/modules/auth/infra/oauth-http.server";
import type { Route } from "./+types/token";

export async function action({ request }: Route.ActionArgs) {
  const config = oauthConfig();
  const form = await readOAuthForm(request);
  if (form.isErr()) return oauthError(form.error);
  const client = authenticateClient(request, form.value, config.clients);
  if (client.isErr()) return oauthError(client.error);
  if (!["authorization_code", "refresh_token"].includes(form.value.grant_type))
    return oauthError("unsupported_grant_type");
  if (form.value.resource !== config.resource)
    return oauthError("invalid_target");
  if (form.value.scope !== undefined && form.value.scope !== "fitness")
    return oauthError("invalid_scope");
  const result = await exchangeToken(form.value, client.value, config.resource);
  return result.match(
    (value) =>
      Response.json(value.body, {
        headers: { ...value.headers, ...privateHeaders },
      }),
    oauthError,
  );
}
