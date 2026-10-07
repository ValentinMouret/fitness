import { createHash, createHmac, randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client, Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { authInvitations, authUsers } from "~/db/schema";
import { createMagicLinkAuth } from "./magic-link.server";
import { createLocalSignInInbox } from "./sign-in-email.server";

const adminUrl = process.env.AUTH_TEST_ADMIN_URL;
const origin = "http://localhost:5196";
const ownerId = randomUUID();
const databaseName = `fitness_code_test_${randomUUID().replaceAll("-", "")}`;
const admin = new Client({ connectionString: adminUrl });
const scratchUrl = new URL(adminUrl ?? "postgresql://localhost/postgres");
scratchUrl.pathname = `/${databaseName}`;
const pool = new Pool({ connectionString: scratchUrl.toString() });
let folder = "";
let created = false;
let inbox = "";
let runtime: ReturnType<typeof createMagicLinkAuth>;
let requestNumber = 0;
const codeMessage = z.object({
  to: z.email(),
  code: z.string().regex(/^[0-9]{6}$/),
});

function headers(
  ip = `198.51.${Math.floor(++requestNumber / 250)}.${(requestNumber % 250) + 1}`,
) {
  return new Headers({ Origin: origin, "X-Real-IP": ip });
}
async function messages() {
  try {
    return (await readFile(inbox, "utf8"))
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => codeMessage.parse(JSON.parse(line)));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT")
      return [];
    throw error;
  }
}
async function invite(email: string) {
  const result = await runtime.invitations.invite({
    actorUserId: ownerId,
    email,
    name: "Code fixture",
    expiresAt: new Date(Date.now() + 60_000),
  });
  if (result.isErr()) throw new Error("Fixture invitation failed");
  return result.value.user;
}
async function send(email: string, requestHeaders = headers()) {
  return runtime.requestSignInCode({ headers: requestHeaders, email });
}
async function issue(email: string) {
  const before = (await messages()).length;
  expect((await send(email)).status).toBe(200);
  await expect.poll(async () => (await messages()).length).toBe(before + 1);
  const message = (await messages()).at(-1);
  if (!message) throw new Error("Missing code fixture");
  expect(message.to).toBe(email.trim().toLowerCase());
  return message.code;
}
async function verify(email: string, code: string, requestHeaders = headers()) {
  return runtime.verifySignInCode({ headers: requestHeaders, email, code });
}
function cookie(response: Response) {
  return response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
}
function direct(path: string, body: object, requestOrigin = origin) {
  const requestHeaders = headers();
  requestHeaders.set("Origin", requestOrigin);
  requestHeaders.set("Content-Type", "application/json");
  return runtime.auth.handler(
    new Request(`${origin}/api/auth${path}`, {
      method: "POST",
      headers: requestHeaders,
      body: JSON.stringify(body),
    }),
  );
}

describe.skipIf(!adminUrl)(
  "invitation-only email codes with pinned Better Auth and PostgreSQL",
  () => {
    beforeAll(async () => {
      await admin.connect();
      await admin.query(
        `create database ${admin.escapeIdentifier(databaseName)}`,
      );
      created = true;
      folder = await mkdtemp(join(tmpdir(), "fitness-code-inbox-"));
      inbox = join(folder, "inbox.jsonl");
      await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
      await drizzle(pool).insert(authUsers).values({
        id: ownerId,
        name: "Code fixture owner",
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
        secret: "fixture-only-code-secret-32-characters",
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

    it("keeps request and wrong-code responses neutral for admitted, missing, uninvited, expired and revoked accounts", async () => {
      const admitted = await invite("neutral-admitted@example.invalid");
      const expired = await invite("neutral-expired@example.invalid");
      const revoked = await invite("neutral-revoked@example.invalid");
      await pool.query(
        "update auth_invitations set expires_at=now()-interval '1 second' where user_id=$1",
        [expired.id],
      );
      expect(
        (
          await runtime.invitations.revoke({
            actorUserId: ownerId,
            userId: revoked.id,
            now: new Date(),
          })
        ).isOk(),
      ).toBe(true);
      await pool.query(
        "insert into auth_users(id,name,email) values($1,'Uninvited fixture','neutral-uninvited@example.invalid')",
        [randomUUID()],
      );
      const before = (await messages()).length;
      for (const email of [
        admitted.email,
        "neutral-missing@example.invalid",
        "neutral-uninvited@example.invalid",
        expired.email,
        revoked.email,
      ]) {
        const response = await send(email);
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ success: true });
        const denied = await verify(email, "not-a-code");
        expect(denied.status).toBe(400);
        expect(await denied.json()).toEqual({
          code: "INVALID_OTP",
          message: "Invalid OTP",
        });
      }
      await expect.poll(async () => (await messages()).length).toBe(before + 1);
      expect((await messages()).at(-1)?.to).toBe(admitted.email);
      expect(
        (
          await pool.query(
            "select id from auth_users where email='neutral-missing@example.invalid'",
          )
        ).rows,
      ).toHaveLength(0);
      const wrongAdmitted = await verify(admitted.email, "000000");
      const wrongMissing = await verify(
        "neutral-missing@example.invalid",
        "000000",
      );
      expect(await wrongAdmitted.json()).toEqual(await wrongMissing.json());
    });

    it("stores a hash with five-minute expiry, normalizes email, and consumes a code once", async () => {
      const user = await invite("canonical@example.invalid");
      const code = await issue(" Canonical@Example.Invalid ");
      const row = (
        await pool.query(
          "select value,expires_at from auth_verifications where identifier=$1 order by created_at desc limit 1",
          [`sign-in-otp-${user.email}`],
        )
      ).rows[0];
      expect(row.value).not.toContain(code);
      expect(row.value).not.toBe(
        `${createHash("sha256").update(code).digest("base64url")}:0`,
      );
      expect(row.value).toBe(
        `${createHmac("sha256", "fixture-only-code-secret-32-characters").update("fitness:sign-in-code:").update(code).digest("base64url")}:0`,
      );
      expect(row.value).toMatch(/^[A-Za-z0-9_-]+:0$/);
      expect(row.expires_at.getTime() - Date.now()).toBeGreaterThan(290_000);
      expect(row.expires_at.getTime() - Date.now()).toBeLessThanOrEqual(
        300_000,
      );
      const response = await verify(" Canonical@Example.Invalid ", code);
      expect(response.status).toBe(200);
      expect(cookie(response)).toContain("better-auth.session_token");
      expect(
        (
          await runtime.getAdmittedSession(
            new Headers({ Cookie: cookie(response) }),
          )
        )?.user.id,
      ).toBe(user.id);
      expect(
        (await runtime.invitations.findByUserId(user.id))?.acceptedAt,
      ).not.toBeNull();
      const replay = await verify(user.email, code);
      expect(replay.status).toBe(400);
      expect(cookie(replay)).toBe("");
    });

    it("rotates resends and does not revive older codes after consuming the latest", async () => {
      const user = await invite("rotate@example.invalid");
      const oldCode = await issue(user.email);
      const newCode = await issue(user.email);
      expect(newCode).not.toBe(oldCode);
      expect((await verify(user.email, oldCode)).status).toBe(400);
      const accepted = await verify(user.email, newCode);
      expect(accepted.status).toBe(200);
      expect((await verify(user.email, oldCode)).status).toBe(400);
      expect((await verify(user.email, newCode)).status).toBe(400);
      expect(
        (
          await pool.query(
            "select id from auth_verifications where identifier=$1",
            [`sign-in-otp-${user.email}`],
          )
        ).rows,
      ).toHaveLength(0);
    });

    it("enforces the per-code three-attempt budget independently of the HTTP IP limit", async () => {
      const user = await invite("attempts@example.invalid");
      const code = await issue(user.email);
      const wrongCode = code === "000000" ? "000001" : "000000";
      for (let attempt = 0; attempt < 3; attempt++) {
        const response = await verify(user.email, wrongCode);
        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({
          code: "INVALID_OTP",
          message: "Invalid OTP",
        });
      }
      const denied = await verify(user.email, code);
      expect(denied.status).toBe(403);
      expect(await denied.json()).toEqual({
        code: "TOO_MANY_ATTEMPTS",
        message: "Too many attempts",
      });
      expect(cookie(denied)).toBe("");
      const replacement = await issue(user.email);
      expect((await verify(user.email, replacement)).status).toBe(200);
    });

    it("rejects expired codes and concurrent replay creates only one session", async () => {
      const expired = await invite("expired-code@example.invalid");
      const expiredCode = await issue(expired.email);
      await pool.query(
        "update auth_verifications set expires_at=now()-interval '1 second' where identifier=$1",
        [`sign-in-otp-${expired.email}`],
      );
      const denied = await verify(expired.email, expiredCode);
      expect(denied.status).toBe(400);
      expect(cookie(denied)).toBe("");
      const user = await invite("concurrent@example.invalid");
      const code = await issue(user.email);
      const responses = await Promise.all([
        verify(user.email, code),
        verify(user.email, code),
      ]);
      expect(responses.map((response) => response.status).sort()).toEqual([
        200, 400,
      ]);
      expect(responses.filter((response) => cookie(response))).toHaveLength(1);
      expect(
        (
          await pool.query("select id from auth_sessions where user_id=$1", [
            user.id,
          ])
        ).rows,
      ).toHaveLength(1);
    });

    for (const change of ["revocation", "expiry"] as const) {
      it(`rejects ${change} between sending and verification before promoting the account`, async () => {
        const user = await invite(`code-${change}@example.invalid`);
        const code = await issue(user.email);
        if (change === "revocation")
          expect(
            (
              await runtime.invitations.revoke({
                actorUserId: ownerId,
                userId: user.id,
                now: new Date(),
              })
            ).isOk(),
          ).toBe(true);
        else
          await pool.query(
            "update auth_invitations set expires_at=now()-interval '1 second' where user_id=$1",
            [user.id],
          );
        const response = await verify(user.email, code);
        expect(response.status).toBe(400);
        expect(cookie(response)).toBe("");
        expect(
          (
            await pool.query(
              "select email_verified from auth_users where id=$1",
              [user.id],
            )
          ).rows[0].email_verified,
        ).toBe(false);
        expect(
          (
            await pool.query("select id from auth_sessions where user_id=$1", [
              user.id,
            ])
          ).rows,
        ).toHaveLength(0);
      });
    }

    for (const change of ["revocation", "expiry"] as const) {
      it(`removes a raw session when ${change} wins after admission but before insertion`, async () => {
        const user = await invite(`code-race-${change}@example.invalid`);
        await pool.query(
          "update auth_users set email_verified=true where id=$1",
          [user.id],
        );
        const code = await issue(user.email);
        const blocker = await pool.connect();
        let pending: Promise<Response> | undefined;
        try {
          await blocker.query("begin");
          await blocker.query(
            "select id from auth_users where id=$1 for update",
            [user.id],
          );
          pending = verify(user.email, code);
          await expect
            .poll(
              async () =>
                (
                  await pool.query(
                    "select pid from pg_stat_activity where datname=current_database() and wait_event_type='Lock' and query like '%auth_sessions%'",
                  )
                ).rowCount,
              { timeout: 5000, interval: 20 },
            )
            .toBeGreaterThan(0);
          if (change === "revocation") {
            expect(
              (
                await runtime.invitations.revoke({
                  actorUserId: ownerId,
                  userId: user.id,
                  now: new Date(),
                })
              ).isOk(),
            ).toBe(true);
          } else {
            await pool.query(
              "update auth_invitations set expires_at=now()-interval '1 second' where user_id=$1",
              [user.id],
            );
          }
          await blocker.query("commit");
          const response = await pending;
          const sessionCookie = cookie(response);
          expect(
            (
              await pool.query(
                "select id from auth_sessions where user_id=$1",
                [user.id],
              )
            ).rows,
          ).toHaveLength(0);
          expect(
            await runtime.auth.api.getSession({
              headers: new Headers({ Cookie: sessionCookie }),
            }),
          ).toBeNull();
          expect(
            await runtime.getAdmittedSession(
              new Headers({ Cookie: sessionCookie }),
            ),
          ).toBeNull();
        } finally {
          await blocker.query("rollback");
          blocker.release();
          await pending;
        }
      });
    }

    it("revocation removes code sessions and blocks outstanding codes without affecting another user", async () => {
      const user = await invite("code-revoke-session@example.invalid");
      const other = await invite("code-keep-session@example.invalid");
      const session = await verify(user.email, await issue(user.email));
      const otherSession = await verify(other.email, await issue(other.email));
      const outstanding = await issue(user.email);
      expect(
        (
          await runtime.invitations.revoke({
            actorUserId: ownerId,
            userId: user.id,
            now: new Date(),
          })
        ).isOk(),
      ).toBe(true);
      expect(
        await runtime.getAdmittedSession(
          new Headers({ Cookie: cookie(session) }),
        ),
      ).toBeNull();
      expect((await verify(user.email, outstanding)).status).toBe(400);
      expect(
        (
          await runtime.getAdmittedSession(
            new Headers({ Cookie: cookie(otherSession) }),
          )
        )?.user.id,
      ).toBe(other.id);
    });

    it("limits direct HTTP requests across email addresses and keeps origin checks enabled", async () => {
      const ip = "203.0.113.200";
      for (let attempt = 0; attempt < 3; attempt++)
        expect(
          (await send(`rate-${attempt}@example.invalid`, headers(ip))).status,
        ).toBe(200);
      const throttled = await send("rate-fourth@example.invalid", headers(ip));
      expect(throttled.status).toBe(429);
      expect(Number(throttled.headers.get("X-Retry-After"))).toBeGreaterThan(0);
      for (let attempt = 0; attempt < 3; attempt++)
        expect(
          (
            await verify(
              `rate-verify-${attempt}@example.invalid`,
              "000000",
              headers(ip),
            )
          ).status,
        ).toBe(400);
      expect(
        (
          await verify(
            "rate-verify-fourth@example.invalid",
            "000000",
            headers(ip),
          )
        ).status,
      ).toBe(429);
      expect(
        (
          await direct(
            "/email-otp/send-verification-otp",
            { email: "owner@example.invalid", type: "sign-in" },
            "https://other.example.invalid",
          )
        ).status,
      ).toBe(403);
      expect(
        (
          await direct(
            "/sign-in/email-otp",
            { email: "owner@example.invalid", otp: "000000" },
            "https://other.example.invalid",
          )
        ).status,
      ).toBe(403);
    });

    it("uses the trusted real-IP header despite a forwarded chain or changing forwarded spoof values", async () => {
      const proxyHeaders = (realIp: string, forwardedIp: string) => {
        const result = headers(realIp);
        result.set("X-Forwarded-For", `${forwardedIp}, 172.17.0.1`);
        return result;
      };
      for (let attempt = 0; attempt < 3; attempt++) {
        expect(
          (
            await send(
              `proxy-${attempt}@example.invalid`,
              proxyHeaders("203.0.113.201", `192.0.2.${attempt + 1}`),
            )
          ).status,
        ).toBe(200);
        expect(
          (
            await verify(
              `proxy-${attempt}@example.invalid`,
              "000000",
              proxyHeaders("203.0.113.201", `192.0.2.${attempt + 1}`),
            )
          ).status,
        ).toBe(400);
      }
      expect(
        (
          await send(
            "proxy-throttled@example.invalid",
            proxyHeaders("203.0.113.201", "192.0.2.99"),
          )
        ).status,
      ).toBe(429);
      expect(
        (
          await verify(
            "proxy-throttled@example.invalid",
            "000000",
            proxyHeaders("203.0.113.201", "192.0.2.99"),
          )
        ).status,
      ).toBe(429);
      expect(
        (
          await send(
            "proxy-other@example.invalid",
            proxyHeaders("203.0.113.202", "192.0.2.99"),
          )
        ).status,
      ).toBe(200);
      expect(
        (
          await verify(
            "proxy-other@example.invalid",
            "000000",
            proxyHeaders("203.0.113.202", "192.0.2.99"),
          )
        ).status,
      ).toBe(400);
    });

    it("exposes only sign-in code operations and refuses alternative OTP flows", async () => {
      for (const type of [
        "email-verification",
        "forget-password",
        "change-email",
      ])
        expect(
          (
            await direct("/email-otp/send-verification-otp", {
              email: "owner@example.invalid",
              type,
            })
          ).status,
        ).toBe(400);
      for (const path of [
        "/sign-in/magic-link",
        "/email-otp/create-verification-otp",
        "/email-otp/get-verification-otp",
        "/email-otp/check-verification-otp",
        "/email-otp/verify-email",
        "/forget-password/email-otp",
        "/email-otp/request-password-reset",
        "/email-otp/reset-password",
        "/email-otp/request-email-change",
        "/email-otp/change-email",
      ]) {
        expect(
          (
            await direct(path, {
              email: "owner@example.invalid",
              type: "sign-in",
              otp: "000000",
            })
          ).status,
        ).toBe(404);
      }
    });

    it("keeps SMTP delivery failure indistinguishable from an unknown account", async () => {
      const failing = createMagicLinkAuth({
        pool,
        origin,
        ownerUserId: ownerId,
        secret: "fixture-only-code-secret-32-characters",
        sendEmail: async () => {
          throw new Error("Fixture delivery failure");
        },
      });
      const user = await invite("delivery-failure@example.invalid");
      const response = await failing.requestSignInCode({
        headers: headers(),
        email: user.email,
      });
      const missing = await failing.requestSignInCode({
        headers: headers(),
        email: "delivery-missing@example.invalid",
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(await missing.json());
    });
  },
);
