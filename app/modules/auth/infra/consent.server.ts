import { createCookie, data, redirect } from "react-router";
import { z } from "zod";
import { env } from "~/env.server";
import { authorizationSchema, validateAuthorization } from "../domain/oauth";
import { hashCredential } from "./crypto.server";
import { issueAuthorizationCode } from "./oauth.repository.server";
import { oauthConfig } from "./oauth-config.server";
import { oauthError, privateHeaders, readOAuthForm } from "./oauth-http.server";
import { requireAuth } from "./session.server";

const ticket = createCookie("fitness-consent", {
  secrets: [env.AUTH_SESSION_SECRET],
});
const ticketSchema = z.object({
  params: authorizationSchema,
  session: z.string(),
  expiresAt: z.number(),
});
const binding = (request: Request) =>
  hashCredential(request.headers.get("Cookie") ?? "");

export async function consentLoader(request: Request) {
  const config = oauthConfig();
  const query = new URL(request.url).searchParams;
  if (new Set(query.keys()).size !== query.size)
    throw oauthError("invalid_request");
  const authorization = validateAuthorization(
    Object.fromEntries(query),
    config.clients,
    config.resource,
  );
  if (authorization.isErr()) throw oauthError(authorization.error);
  await requireAuth(request);
  const consent = await ticket.serialize({
    params: authorization.value.params,
    session: binding(request),
    expiresAt: Date.now() + 600000,
  });
  return data(
    { clientName: authorization.value.client.name, consent },
    { headers: privateHeaders },
  );
}

export async function consentAction(request: Request) {
  const config = oauthConfig();
  await requireAuth(request);
  const form = await readOAuthForm(request);
  if (form.isErr()) return oauthError(form.error);
  let value: unknown;
  try {
    value = await ticket.parse(form.value.consent ?? "");
  } catch {
    return oauthError("invalid_request");
  }
  const parsed = ticketSchema.safeParse(value);
  if (
    !parsed.success ||
    parsed.data.expiresAt <= Date.now() ||
    parsed.data.session !== binding(request)
  )
    return oauthError("invalid_request");
  const authorization = validateAuthorization(
    parsed.data.params,
    config.clients,
    config.resource,
  );
  if (authorization.isErr()) return oauthError(authorization.error);
  const { params, client } = authorization.value;
  const destination = new URL(client.redirectUri);
  if (params.state) destination.searchParams.set("state", params.state);
  destination.searchParams.set("iss", config.issuer);
  if (form.value.decision === "deny") {
    destination.searchParams.set("error", "access_denied");
  } else if (form.value.decision === "allow") {
    const result = await issueAuthorizationCode(params, client);
    if (result.isErr()) return oauthError(result.error);
    destination.searchParams.set("code", result.value);
  } else return oauthError("invalid_request");
  return redirect(destination.href, { status: 303, headers: privateHeaders });
}
