import { createHash, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { closeConnections, db } from "~/db";
import { hashCredential } from "./crypto.server";
import {
  exchangeToken,
  findAccess,
  issueAuthorizationCode,
} from "./oauth.repository.server";
import { oauthCodes, oauthConnections, oauthTokens } from "./schema";

const resource = "http://localhost:5175/mcp";
const client = {
  id: `auth-integration-${randomUUID()}`,
  name: "Test",
  secret: "integration-test-secret-long-enough",
  redirectUri: "https://example.invalid/callback",
};
const verifier = "a".repeat(43);
const connections: string[] = [];

async function issue() {
  const result = await issueAuthorizationCode(
    {
      response_type: "code",
      client_id: client.id,
      redirect_uri: client.redirectUri,
      scope: "fitness",
      resource,
      code_challenge: createHash("sha256").update(verifier).digest("base64url"),
      code_challenge_method: "S256",
    },
    client,
  );
  if (result.isErr()) throw new Error(result.error);
  const [stored] = await db
    .select()
    .from(oauthCodes)
    .where(eq(oauthCodes.hash, hashCredential(result.value)));
  connections.push(stored.connectionId);
  return { raw: result.value, stored };
}
const exchange = (code: string) =>
  exchangeToken(
    {
      grant_type: "authorization_code",
      code,
      code_verifier: verifier,
      redirect_uri: client.redirectUri,
      resource,
    },
    client,
    resource,
  );
const refresh = (refreshToken: string) =>
  exchangeToken(
    { grant_type: "refresh_token", refresh_token: refreshToken, resource },
    client,
    resource,
  );

afterEach(async () => {
  vi.restoreAllMocks();
  for (const id of connections.splice(0)) {
    await db.delete(oauthTokens).where(eq(oauthTokens.connectionId, id));
    await db.delete(oauthCodes).where(eq(oauthCodes.connectionId, id));
    await db.delete(oauthConnections).where(eq(oauthConnections.id, id));
  }
});
afterAll(closeConnections);

describe("persistent OAuth expiry and transactions", () => {
  it("rejects expired codes using the persisted expiry", async () => {
    const code = await issue();
    await db
      .update(oauthCodes)
      .set({ expiresAt: new Date(Date.now() - 1) })
      .where(eq(oauthCodes.hash, code.stored.hash));
    expect((await exchange(code.raw)).isErr()).toBe(true);
  });
  it("rejects expired access and refresh tokens", async () => {
    const code = await issue();
    const result = await exchange(code.raw);
    if (result.isErr()) throw new Error(result.error);
    const pair = result.value.body;
    expect(
      (
        await findAccess(pair.access_token, resource, [client.id])
      )._unsafeUnwrap(),
    ).toBe(code.stored.connectionId);
    await db
      .update(oauthTokens)
      .set({
        accessExpiresAt: new Date(Date.now() - 1),
        refreshExpiresAt: new Date(Date.now() - 1),
      })
      .where(eq(oauthTokens.connectionId, code.stored.connectionId));
    expect(
      (
        await findAccess(pair.access_token, resource, [client.id])
      )._unsafeUnwrap(),
    ).toBeNull();
    expect((await refresh(pair.refresh_token)).isErr()).toBe(true);
  });
  it("checks token resource and enabled client even with a valid bearer token", async () => {
    const code = await issue();
    const result = await exchange(code.raw);
    if (result.isErr()) throw new Error(result.error);
    expect(
      (
        await findAccess(result.value.body.access_token, `${resource}/other`, [
          client.id,
        ])
      )._unsafeUnwrap(),
    ).toBeNull();
    expect(
      (
        await findAccess(result.value.body.access_token, resource, [])
      )._unsafeUnwrap(),
    ).toBeNull();
  });
  it("rolls back code consumption when token persistence fails", async () => {
    const code = await issue();
    // Inject a failing insert only after revokeAuthorizationCode has updated the row.
    const transaction = db.transaction.bind(db);
    vi.spyOn(db, "transaction").mockImplementation((callback) =>
      transaction(async (tx) => {
        vi.spyOn(tx, "insert").mockImplementation(() => {
          throw new Error("Injected token insert failure");
        });
        return callback(tx);
      }),
    );
    const failed = await exchange(code.raw);
    expect(failed.isErr()).toBe(true);
    const [stored] = await db
      .select()
      .from(oauthCodes)
      .where(eq(oauthCodes.hash, code.stored.hash));
    expect(stored.consumedAt).toBeNull();
    vi.restoreAllMocks();
    expect((await exchange(code.raw)).isOk()).toBe(true);
  });
  it("keeps the refresh token usable if persisting its replacement fails", async () => {
    const code = await issue();
    const issued = await exchange(code.raw);
    if (issued.isErr()) throw new Error(issued.error);
    const transaction = db.transaction.bind(db);
    vi.spyOn(db, "transaction").mockImplementation((callback) =>
      transaction(async (tx) => {
        vi.spyOn(tx, "insert").mockImplementation(() => {
          throw new Error("Injected token insert failure");
        });
        return callback(tx);
      }),
    );
    expect((await refresh(issued.value.body.refresh_token)).isErr()).toBe(true);
    vi.restoreAllMocks();
    expect((await refresh(issued.value.body.refresh_token)).isOk()).toBe(true);
  });
});
