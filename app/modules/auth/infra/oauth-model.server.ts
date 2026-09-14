import OAuth2Server from "@node-oauth/oauth2-server";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import type { db } from "~/db";
import { env } from "~/env.server";
import { connectionIsActive, type OAuthClient } from "../domain/oauth";
import { hashCredential, randomCredential } from "./crypto.server";
import { oauthCodes, oauthConnections, oauthTokens } from "./schema";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Connection = typeof oauthConnections.$inferSelect;

export function libraryClient(client: OAuthClient) {
  return {
    id: client.id,
    grants: ["authorization_code", "refresh_token"],
    redirectUris: [client.redirectUri],
  };
}

export function createOAuthServer(
  tx: Transaction,
  client: OAuthClient,
  resource: string,
  connection?: Connection,
) {
  const user = { connectionId: connection?.id };
  const model: OAuth2Server.AuthorizationCodeModel &
    OAuth2Server.RefreshTokenModel = {
    getClient: async (id) => (id === client.id ? libraryClient(client) : false),
    generateAccessToken: randomCredential,
    generateRefreshToken: randomCredential,
    generateAuthorizationCode: randomCredential,
    validateScope: async (_user, _client, scope) =>
      scope?.length === 1 && scope[0] === "fitness" ? ["fitness"] : false,
    validateRedirectUri: async (uri) => uri === client.redirectUri,
    getAccessToken: async () => false,
    saveAuthorizationCode: async (code, libraryClient, owner) => {
      const [approved] = await tx
        .insert(oauthConnections)
        .values({ clientId: client.id, resource, scope: "fitness" })
        .returning();
      if (!approved || !code.codeChallenge)
        throw new Error("Missing approved connection or PKCE challenge");
      await tx.insert(oauthCodes).values({
        hash: hashCredential(code.authorizationCode),
        connectionId: approved.id,
        redirectUri: code.redirectUri,
        challenge: code.codeChallenge,
        expiresAt: code.expiresAt,
      });
      return { ...code, client: libraryClient, user: owner };
    },
    getAuthorizationCode: async (raw) => {
      if (!connection || !connectionIsActive(connection, resource))
        return false;
      const [code] = await tx
        .select()
        .from(oauthCodes)
        .where(
          and(
            eq(oauthCodes.hash, hashCredential(raw)),
            eq(oauthCodes.connectionId, connection.id),
          ),
        );
      if (!code || code.consumedAt || code.expiresAt.getTime() <= Date.now())
        return false;
      return {
        authorizationCode: raw,
        expiresAt: code.expiresAt,
        redirectUri: code.redirectUri,
        codeChallenge: code.challenge,
        codeChallengeMethod: "S256",
        scope: ["fitness"],
        client: libraryClient(client),
        user,
      };
    },
    revokeAuthorizationCode: async (code) => {
      const changed = await tx
        .update(oauthCodes)
        .set({ consumedAt: new Date() })
        .where(
          and(
            eq(oauthCodes.hash, hashCredential(code.authorizationCode)),
            isNull(oauthCodes.consumedAt),
          ),
        )
        .returning({ hash: oauthCodes.hash });
      return changed.length === 1;
    },
    getRefreshToken: async (raw) => {
      if (!connection || !connectionIsActive(connection, resource))
        return false;
      const [token] = await tx
        .select()
        .from(oauthTokens)
        .where(
          and(
            eq(oauthTokens.refreshHash, hashCredential(raw)),
            eq(oauthTokens.connectionId, connection.id),
          ),
        );
      if (!token) return false;
      if (token.rotatedAt) {
        await tx
          .update(oauthConnections)
          .set({ revokedAt: new Date() })
          .where(eq(oauthConnections.id, connection.id));
        return false;
      }
      if (token.refreshExpiresAt.getTime() <= Date.now()) return false;
      return {
        refreshToken: raw,
        refreshTokenExpiresAt: token.refreshExpiresAt,
        scope: ["fitness"],
        client: libraryClient(client),
        user,
      };
    },
    revokeToken: async (token) => {
      const changed = await tx
        .update(oauthTokens)
        .set({ rotatedAt: new Date() })
        .where(
          and(
            eq(oauthTokens.refreshHash, hashCredential(token.refreshToken)),
            isNull(oauthTokens.rotatedAt),
          ),
        )
        .returning({ hash: oauthTokens.refreshHash });
      return changed.length === 1;
    },
    saveToken: async (token, libraryClient, owner) => {
      const connectionId = z.string().uuid().parse(owner.connectionId);
      const pair = z
        .object({
          accessToken: z.string(),
          refreshToken: z.string(),
          accessTokenExpiresAt: z.date(),
          refreshTokenExpiresAt: z.date(),
        })
        .parse(token);
      await tx.insert(oauthTokens).values({
        accessHash: hashCredential(pair.accessToken),
        refreshHash: hashCredential(pair.refreshToken),
        connectionId,
        accessExpiresAt: pair.accessTokenExpiresAt,
        refreshExpiresAt: pair.refreshTokenExpiresAt,
      });
      return { ...token, client: libraryClient, user: owner };
    },
  };
  return new OAuth2Server({
    model,
    authorizationCodeLifetime: env.OAUTH_CODE_TTL_SECONDS,
    accessTokenLifetime: env.OAUTH_ACCESS_TTL_SECONDS,
    refreshTokenLifetime: env.OAUTH_REFRESH_TTL_SECONDS,
    alwaysIssueNewRefreshToken: true,
  });
}
