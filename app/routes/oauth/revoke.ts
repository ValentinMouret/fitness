import { revokeConnection } from "~/modules/auth/infra/oauth.repository.server";
import { oauthConfig } from "~/modules/auth/infra/oauth-config.server";
import {
  authenticateClient,
  oauthError,
  privateHeaders,
  readOAuthForm,
} from "~/modules/auth/infra/oauth-http.server";
import type { Route } from "./+types/revoke";

export async function action({ request }: Route.ActionArgs) {
  const config = oauthConfig();
  const form = await readOAuthForm(request);
  if (form.isErr()) return oauthError(form.error);
  const client = authenticateClient(request, form.value, config.clients);
  if (client.isErr()) return oauthError(client.error);
  if (!form.value.token) return oauthError("invalid_request");
  const result = await revokeConnection(form.value.token, client.value);
  return result.match(
    () => new Response(null, { status: 200, headers: privateHeaders }),
    oauthError,
  );
}
