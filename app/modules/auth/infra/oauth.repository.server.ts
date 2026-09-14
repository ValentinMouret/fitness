import OAuth2Server from "@node-oauth/oauth2-server";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import { err, ok, ResultAsync } from "neverthrow";
import { db } from "~/db";
import { logger } from "~/logger.server";
import type { Authorization, OAuthClient, OAuthFailure } from "../domain/oauth";
import { hashCredential } from "./crypto.server";
import {
  libraryRequest,
  protocolResult,
  tokenResponseSchema,
} from "./oauth-http.server";
import { createOAuthServer } from "./oauth-model.server";
import { oauthCodes, oauthConnections, oauthTokens } from "./schema";

function storageError(): OAuthFailure {
  logger.error("OAuth storage operation failed");
  return "server_error";
}

export function issueAuthorizationCode(
  params: Authorization,
  client: OAuthClient,
) {
  return ResultAsync.fromPromise(
    db.transaction(async (tx) => {
      const server = createOAuthServer(tx, client, params.resource);
      const response = new OAuth2Server.Response();
      const result = await protocolResult(() =>
        server.authorize(libraryRequest(params), response, {
          allowEmptyState: true,
          authenticateHandler: { handle: async () => ({ owner: true }) },
        }),
      );
      if (result.isErr()) return err<never, OAuthFailure>("invalid_request");
      return ok(result.value.authorizationCode);
    }),
    storageError,
  ).andThen((result) => result);
}

export function exchangeToken(
  body: Readonly<Record<string, string>>,
  client: OAuthClient,
  resource: string,
) {
  return ResultAsync.fromPromise(
    db.transaction(async (tx) => {
      const isCode = body.grant_type === "authorization_code";
      const hash = hashCredential(
        isCode ? (body.code ?? "") : (body.refresh_token ?? ""),
      );
      const found = isCode
        ? await tx
            .select({ id: oauthCodes.connectionId })
            .from(oauthCodes)
            .where(eq(oauthCodes.hash, hash))
        : await tx
            .select({ id: oauthTokens.connectionId })
            .from(oauthTokens)
            .where(eq(oauthTokens.refreshHash, hash));
      if (!found[0]) return err<never, OAuthFailure>("invalid_grant");
      // All issuance, rotation, replay, and revocation serialize on the connection.
      const [connection] = await tx
        .select()
        .from(oauthConnections)
        .where(
          and(
            eq(oauthConnections.id, found[0].id),
            eq(oauthConnections.clientId, client.id),
          ),
        )
        .for("update");
      if (
        !connection ||
        connection.revokedAt ||
        connection.resource !== resource ||
        connection.scope !== "fitness"
      )
        return err<never, OAuthFailure>("invalid_grant");
      if (isCode) {
        const [code] = await tx
          .select()
          .from(oauthCodes)
          .where(eq(oauthCodes.hash, hash));
        if (!code || code.redirectUri !== body.redirect_uri)
          return err<never, OAuthFailure>("invalid_grant");
      }
      const server = createOAuthServer(tx, client, resource, connection);
      const response = new OAuth2Server.Response();
      const result = await protocolResult(() =>
        server.token(
          libraryRequest({
            ...body,
            client_id: client.id,
            client_secret: client.secret,
          }),
          response,
        ),
      );
      if (result.isErr())
        return err<never, OAuthFailure>(
          result.error.name === "invalid_scope"
            ? "invalid_scope"
            : "invalid_grant",
        );
      return ok({
        body: tokenResponseSchema.parse(response.body),
        headers: response.headers,
      });
    }),
    storageError,
  ).andThen((result) => result);
}

export function revokeConnection(raw: string, client: OAuthClient) {
  return ResultAsync.fromPromise(
    db.transaction(async (tx) => {
      const hash = hashCredential(raw);
      const [token] = await tx
        .select({ id: oauthTokens.connectionId })
        .from(oauthTokens)
        .where(
          or(
            eq(oauthTokens.refreshHash, hash),
            eq(oauthTokens.accessHash, hash),
          ),
        );
      if (!token) return;
      await tx
        .update(oauthConnections)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(oauthConnections.id, token.id),
            eq(oauthConnections.clientId, client.id),
            isNull(oauthConnections.revokedAt),
          ),
        );
    }),
    storageError,
  );
}

export function findAccess(
  raw: string,
  resource: string,
  clientIds: readonly string[],
) {
  return ResultAsync.fromPromise(
    db
      .select({ connection: oauthConnections, token: oauthTokens })
      .from(oauthTokens)
      .innerJoin(
        oauthConnections,
        eq(oauthTokens.connectionId, oauthConnections.id),
      )
      .where(
        and(
          eq(oauthTokens.accessHash, hashCredential(raw)),
          gt(oauthTokens.accessExpiresAt, new Date()),
          isNull(oauthConnections.revokedAt),
          eq(oauthConnections.resource, resource),
          eq(oauthConnections.scope, "fitness"),
        ),
      )
      .limit(1),
    storageError,
  ).map((rows) =>
    rows[0] && clientIds.includes(rows[0].connection.clientId)
      ? rows[0].connection.id
      : null,
  );
}
