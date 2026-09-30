import { createHash, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { closeConnections, db } from "~/db";
import { authInvitations, authUsers } from "~/db/schema";
import { type UserId, userIdSchema } from "../domain/user";
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

const ownerId = userIdSchema.parse(randomUUID());
const otherId = userIdSchema.parse(randomUUID());
beforeAll(async () => {
  for (const id of [ownerId, otherId]) {
    await db
      .insert(authUsers)
      .values({ id, name: "OAuth fixture", email: `${id}@example.invalid` });
    await db
      .insert(authInvitations)
      .values({
        userId: id,
        invitedBy: ownerId,
        expiresAt: new Date(),
        acceptedAt: new Date(),
      });
  }
});

async function issue(userId: UserId = ownerId) {
  const result = await issueAuthorizationCode(
    userId,
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
afterAll(async () => {
  await db.delete(authInvitations).where(eq(authInvitations.userId, otherId));
  await db.delete(authUsers).where(eq(authUsers.id, otherId));
  await db.delete(authUsers).where(eq(authUsers.id, ownerId));
  await closeConnections();
});

describe("persistent OAuth expiry and transactions", () => {
  it("binds each credential to its consenting account and rejects revoked admission", async () => {
    const [a, b] = await Promise.all([issue(ownerId), issue(otherId)]);
    const [aPair, bPair] = await Promise.all([
      exchange(a.raw),
      exchange(b.raw),
    ]);
    const aTokens = aPair._unsafeUnwrap().body;
    const bTokens = bPair._unsafeUnwrap().body;
    expect(
      (
        await findAccess(aTokens.access_token, resource, [client.id])
      )._unsafeUnwrap()?.user.id,
    ).toBe(ownerId);
    expect(
      (
        await findAccess(bTokens.access_token, resource, [client.id])
      )._unsafeUnwrap()?.user.id,
    ).toBe(otherId);
    const pending = await issue(otherId);
    await db
      .update(authInvitations)
      .set({ revokedAt: new Date() })
      .where(eq(authInvitations.userId, otherId));
    try {
      await expect(issue(otherId)).rejects.toThrow("invalid_request");
      expect(
        (
          await findAccess(bTokens.access_token, resource, [client.id])
        )._unsafeUnwrap(),
      ).toBeNull();
      expect((await refresh(bTokens.refresh_token)).isErr()).toBe(true);
      expect((await exchange(pending.raw)).isErr()).toBe(true);
      expect(
        (
          await findAccess(aTokens.access_token, resource, [client.id])
        )._unsafeUnwrap()?.user.id,
      ).toBe(ownerId);
      expect((await refresh(aTokens.refresh_token)).isOk()).toBe(true);
    } finally {
      await db
        .update(authInvitations)
        .set({ revokedAt: null })
        .where(eq(authInvitations.userId, otherId));
    }
  });

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
    ).toEqual({
      connectionId: code.stored.connectionId,
      user: { id: ownerId, email: `${ownerId}@example.invalid` },
    });
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
