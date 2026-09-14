import OAuth2Server from "@node-oauth/oauth2-server";
import { err, ok } from "neverthrow";
import { z } from "zod";
import type { OAuthClient, OAuthFailure } from "../domain/oauth";
import { credentialsMatch } from "./crypto.server";

export const tokenResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  token_type: z.string(),
  expires_in: z.number(),
  scope: z.literal("fitness"),
});

export const privateHeaders = {
  "Cache-Control": "no-store",
  Pragma: "no-cache",
  "Referrer-Policy": "no-referrer",
};

export function oauthError(
  error: OAuthFailure,
  status = error === "invalid_client"
    ? 401
    : error === "server_error"
      ? 500
      : 400,
) {
  return Response.json(
    { error },
    {
      status,
      headers: {
        ...privateHeaders,
        ...(status === 401
          ? { "WWW-Authenticate": 'Basic realm="Fitness"' }
          : {}),
      },
    },
  );
}

export async function readOAuthForm(request: Request) {
  if (
    !request.headers
      .get("Content-Type")
      ?.startsWith("application/x-www-form-urlencoded")
  )
    return err<never, OAuthFailure>("invalid_request");
  const text = await request.text();
  if (text.length > 16384) return err<never, OAuthFailure>("invalid_request");
  const params = new URLSearchParams(text);
  if (new Set(params.keys()).size !== params.size)
    return err<never, OAuthFailure>("invalid_request");
  return ok(Object.fromEntries(params));
}

export function authenticateClient(
  request: Request,
  body: Readonly<Record<string, string>>,
  clients: readonly OAuthClient[],
) {
  let id = body.client_id;
  let secret = body.client_secret;
  const header = request.headers.get("Authorization");
  if (header) {
    if (id || secret || !/^Basic /i.test(header))
      return err<never, OAuthFailure>("invalid_client");
    try {
      const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
      const colon = decoded.indexOf(":");
      if (colon < 0) return err<never, OAuthFailure>("invalid_client");
      id = decodeURIComponent(decoded.slice(0, colon));
      secret = decodeURIComponent(decoded.slice(colon + 1));
    } catch {
      return err<never, OAuthFailure>("invalid_client");
    }
  }
  const client = clients.find((client) => client.id === id);
  return client && secret && credentialsMatch(secret, client.secret)
    ? ok(client)
    : err<never, OAuthFailure>("invalid_client");
}

export function libraryRequest(body: Readonly<Record<string, string>>) {
  return new OAuth2Server.Request({
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "content-length": String(
        Buffer.byteLength(new URLSearchParams(body).toString()),
      ),
    },
    query: {},
    body,
  });
}

export async function protocolResult<T>(operation: () => Promise<T>) {
  try {
    return ok(await operation());
  } catch (error) {
    if (error instanceof OAuth2Server.OAuthError && error.code < 500)
      return err(error);
    throw error;
  }
}
