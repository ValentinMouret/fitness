import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client, Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { authInvitations, authUsers } from "~/db/schema";
import { createMagicLinkAuth } from "./magic-link.server";
import { createLocalSignInInbox } from "./sign-in-email.server";

const adminUrl = process.env.AUTH_TEST_ADMIN_URL;
const origin = "http://localhost:5196";
const ownerId = randomUUID();
const databaseName = `fitness_auth_test_${randomUUID().replaceAll("-", "")}`;
const admin = new Client({ connectionString: adminUrl });
const scratchUrl = new URL(adminUrl ?? "postgresql://localhost/postgres");
scratchUrl.pathname = `/${databaseName}`;
const pool = new Pool({ connectionString: scratchUrl.toString() });
let folder = "";
let created = false;
let inbox = "";
let runtime: ReturnType<typeof createMagicLinkAuth>;

const request = (
  path: string,
  body?: object,
  cookie?: string,
  requestOrigin = origin,
) =>
  new Request(`${origin}/api/auth${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      ...(body
        ? { "Content-Type": "application/json", Origin: requestOrigin }
        : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

async function invite(email: string) {
  const result = await runtime.invitations.invite({
    actorUserId: ownerId,
    email,
    name: "Fixture user",
    expiresAt: new Date(Date.now() + 60_000),
  });
  expect(result.isOk()).toBe(true);
  if (result.isErr()) throw new Error("Fixture invitation failed");
  return result.value;
}

async function sentMessages(): Promise<
  readonly { readonly to: string; readonly url: string }[]
> {
  try {
    return (await readFile(inbox, "utf8"))
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT")
      return [];
    throw error;
  }
}

async function signIn(email: string) {
  const response = await runtime.auth.handler(
    request("/sign-in/magic-link", { email, callbackURL: "/dashboard" }),
  );
  expect(response.status).toBe(200);
  const message = (await sentMessages()).at(-1);
  if (!message) throw new Error("Missing fixture email");
  expect(message.to).toBe(email.toLowerCase());
  return message;
}

async function redeem(url: string) {
  const response = await runtime.auth.handler(new Request(url));
  return {
    response,
    cookie: response.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; "),
  };
}

describe.skipIf(!adminUrl)(
  "invitation-only native PostgreSQL magic links",
  () => {
    beforeAll(async () => {
      await admin.connect();
      await admin.query(
        `create database ${admin.escapeIdentifier(databaseName)}`,
      );
      created = true;
      folder = await mkdtemp(join(tmpdir(), "fitness-auth-inbox-"));
      inbox = join(folder, "inbox.jsonl");
      await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
      await drizzle(pool).insert(authUsers).values({
        id: ownerId,
        name: "Fixture owner",
        email: "owner@example.invalid",
      });
      await drizzle(pool).insert(authInvitations).values({
        userId: ownerId,
        invitedBy: ownerId,
        expiresAt: new Date(),
        acceptedAt: new Date(),
      });
      runtime = createMagicLinkAuth({
        pool,
        origin,
        ownerUserId: ownerId,
        secret: "fixture-only-magic-link-secret-32-characters",
        sendEmail: createLocalSignInInbox({ path: inbox, environment: "test" }),
      });
    }, 30_000);

    afterAll(async () => {
      await pool.end();
      if (created)
        await admin.query(
          `drop database ${admin.escapeIdentifier(databaseName)}`,
        );
      await admin.end();
      if (folder) await rm(folder, { recursive: true, force: true });
    });

    it("returns the same request response but sends no email to an uninvited address", async () => {
      const before = await sentMessages();
      const response = await runtime.auth.handler(
        request("/sign-in/magic-link", { email: "unknown@example.invalid" }),
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ status: true });
      expect(await sentMessages()).toEqual(before);
      expect(
        (
          await pool.query("select id from auth_users where email=$1", [
            "unknown@example.invalid",
          ])
        ).rows,
      ).toHaveLength(0);
    });

    it("delivers local email, stores a hash, consumes once and identifies the invited session", async () => {
      const email = "first@example.invalid";
      const { user } = await invite(email);
      const message = await signIn(email);
      const token = new URL(message.url).searchParams.get("token");
      const verification = (
        await pool.query(
          "select identifier from auth_verifications where value::jsonb->>'email'=$1",
          [email],
        )
      ).rows[0];
      expect(verification.identifier).not.toBe(token);
      expect((await stat(inbox)).mode & 0o777).toBe(0o600);
      const { response, cookie } = await redeem(message.url);
      expect(response.status).toBe(302);
      expect(cookie).toContain("better-auth.session_token");
      expect(
        (await runtime.getAdmittedSession(new Headers({ Cookie: cookie })))
          ?.user.id,
      ).toBe(user.id);
      expect(
        (await runtime.invitations.findByUserId(user.id))?.acceptedAt,
      ).not.toBeNull();
      const repeated = await redeem(message.url);
      expect(repeated.response.headers.get("location")).toContain(
        "INVALID_TOKEN",
      );
      expect(repeated.cookie).toBe("");
    });

    it("rejects expired invitations at send time and after a link has been issued", async () => {
      const email = "expired@example.invalid";
      const { user } = await invite(email);
      const message = await signIn(email);
      await pool.query(
        "update auth_invitations set expires_at=now()-interval '1 second' where user_id=$1",
        [user.id],
      );
      const before = await sentMessages();
      expect(
        (await runtime.auth.handler(request("/sign-in/magic-link", { email })))
          .status,
      ).toBe(200);
      expect(await sentMessages()).toEqual(before);
      const rejected = await redeem(message.url);
      expect(rejected.cookie).toBe("");
      expect(rejected.response.headers.get("location")).toContain(
        "failed_to_create_session",
      );
      expect(
        (
          await pool.query("select id from auth_sessions where user_id=$1", [
            user.id,
          ])
        ).rows,
      ).toHaveLength(0);
    });

    it("rejects an expired magic link", async () => {
      const email = "token-expired@example.invalid";
      await invite(email);
      const message = await signIn(email);
      await pool.query(
        "update auth_verifications set expires_at=now()-interval '1 second' where value::jsonb->>'email'=$1",
        [email],
      );
      const result = await redeem(message.url);
      expect(result.cookie).toBe("");
      expect(result.response.headers.get("location")).toContain(
        "INVALID_TOKEN",
      );
    });

    it("redeems a mixed-case email request for its canonical invitation", async () => {
      const { user } = await invite("mixed@example.invalid");
      const message = await signIn("Mixed@Example.Invalid");
      const result = await redeem(message.url);
      expect(
        (
          await runtime.getAdmittedSession(
            new Headers({ Cookie: result.cookie }),
          )
        )?.user.id,
      ).toBe(user.id);
    });

    it("retains Better Auth's deterministic verification reservation keys under concurrency", async () => {
      const context = await runtime.auth.$context;
      const identifier = `fixture-lock-${randomUUID()}`;
      const results = await Promise.all(
        [1, 2].map(() =>
          context.internalAdapter.reserveVerificationValue({
            identifier,
            value: "fixture",
            expiresAt: new Date(Date.now() + 60_000),
          }),
        ),
      );
      expect(results.sort()).toEqual([false, true]);
      const rows = (
        await pool.query(
          "select id from auth_verifications where identifier=$1",
          [identifier],
        )
      ).rows;
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toHaveLength(43);
    });

    it("revokes existing sessions and rejects an outstanding link without affecting another user", async () => {
      const first = await invite("revoke-a@example.invalid");
      const second = await invite("revoke-b@example.invalid");
      const firstSession = await redeem((await signIn(first.user.email)).url);
      const secondSession = await redeem((await signIn(second.user.email)).url);
      const outstanding = await signIn(first.user.email);
      expect(
        (
          await runtime.invitations.revoke({
            actorUserId: second.user.id,
            userId: first.user.id,
            now: new Date(),
          })
        ).isErr(),
      ).toBe(true);
      expect(
        (
          await runtime.invitations.revoke({
            actorUserId: ownerId,
            userId: first.user.id,
            now: new Date(),
          })
        ).isOk(),
      ).toBe(true);
      expect(
        await runtime.getAdmittedSession(
          new Headers({ Cookie: firstSession.cookie }),
        ),
      ).toBeNull();
      expect(
        (
          await runtime.getAdmittedSession(
            new Headers({ Cookie: secondSession.cookie }),
          )
        )?.user.id,
      ).toBe(second.user.id);
      expect((await redeem(outstanding.url)).cookie).toBe("");
    });

    it("logs out one session and keeps another session active", async () => {
      const first = await invite("logout-a@example.invalid");
      const second = await invite("logout-b@example.invalid");
      const a = await redeem((await signIn(first.user.email)).url);
      const b = await redeem((await signIn(second.user.email)).url);
      expect(
        (await runtime.auth.handler(request("/sign-out", {}, a.cookie))).status,
      ).toBe(200);
      expect(
        await runtime.getAdmittedSession(new Headers({ Cookie: a.cookie })),
      ).toBeNull();
      expect(
        (await runtime.getAdmittedSession(new Headers({ Cookie: b.cookie })))
          ?.user.id,
      ).toBe(second.user.id);
    });

    it("rejects non-owner invitations, password signup, and cross-origin mutations", async () => {
      expect(
        (
          await runtime.invitations.invite({
            actorUserId: randomUUID(),
            email: "denied@example.invalid",
            name: "Denied",
            expiresAt: new Date(Date.now() + 60_000),
          })
        ).isErr(),
      ).toBe(true);
      expect(
        (
          await runtime.auth.handler(
            request("/sign-up/email", {
              email: "password@example.invalid",
              name: "Denied",
              password: "fixture-password",
            }),
          )
        ).status,
      ).toBe(400);
      expect(
        (
          await runtime.auth.handler(
            request(
              "/sign-in/magic-link",
              { email: "owner@example.invalid" },
              undefined,
              "https://other.example.invalid",
            ),
          )
        ).status,
      ).toBe(403);
    });
  },
);
