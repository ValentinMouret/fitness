import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";
import pg from "pg";
import {
  UNSAFE_decodeViaTurboStream,
  UNSAFE_SingleFetchRedirectSymbol,
} from "react-router";
import { z } from "zod";
import { credentials, sessionCookieName } from "./support/auth";
import {
  canWriteFixtureDatabase,
  verifyFixtureServerDatabase,
} from "./support/fixture-database";
import { authorization, clients, discover } from "./support/oauth";

const databaseUrl = process.env.E2E_DATABASE_URL;
const inbox = process.env.AUTH_LOCAL_INBOX;
const ownerId = process.env.AUTH_FOUNDATION_OWNER_USER_ID;
const ownerEmail = "owner@example.invalid";
const messageSchema = z.object({ to: z.email(), url: z.url() });

test.skip(
  process.env.AUTH_FOUNDATION_ENABLED !== "true" ||
    !inbox ||
    !ownerId ||
    !canWriteFixtureDatabase(databaseUrl),
  "Requires local auth foundation and matching dedicated fixture database",
);
test.describe.configure({ mode: "serial" });

test.use({
  storageState: { cookies: [], origins: [] },
  viewport: { width: 390, height: 844 },
});

async function messages() {
  if (!inbox) throw new Error("Missing local inbox path");
  try {
    return (await readFile(inbox, "utf8"))
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => messageSchema.parse(JSON.parse(line)));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT")
      return [];
    throw error;
  }
}

async function openLatestEmail(page: Page, email: string) {
  await expect
    .poll(async () =>
      (await messages()).some((message) => message.to === email),
    )
    .toBe(true);
  const message = (await messages())
    .filter((message) => message.to === email)
    .at(-1);
  if (!message) throw new Error("Missing sign-in email");
  await page.goto(message.url);
  await expect(
    page.getByText(`Signed in as ${email}`, { exact: true }),
  ).toBeVisible();
}

test("foundation routes distinguish public sign-in from owner-only invitation management", async ({
  request,
}) => {
  const attempts: readonly Readonly<Record<string, string>>[] = [
    {},
    {
      Cookie: `${sessionCookieName}=${encodeURIComponent(JSON.stringify({ username: credentials.username }))}`,
    },
  ];
  for (const headers of attempts) {
    expect(
      (await request.get("/sign-in", { headers, maxRedirects: 0 })).status(),
    ).toBe(200);
    const session = await request.get("/api/auth/get-session", { headers });
    expect(session.status()).toBe(200);
    expect(await session.json()).toBeNull();
    const directLoader = await request.get("/account/invitations.data", {
      headers,
      maxRedirects: 0,
    });
    expect(directLoader.status()).toBe(202);
    const body = new Response(await directLoader.text()).body;
    if (!body) throw new Error("Missing native loader response");
    const decoded = await UNSAFE_decodeViaTurboStream(body, globalThis);
    const result = z
      .custom<Record<symbol, unknown>>(
        (value) =>
          typeof value === "object" &&
          value !== null &&
          UNSAFE_SingleFetchRedirectSymbol in value,
      )
      .parse(decoded.value);
    expect(Object.keys(result)).toHaveLength(0);
    expect(
      z
        .object({ redirect: z.string(), status: z.number() })
        .parse(result[UNSAFE_SingleFetchRedirectSymbol]),
    ).toEqual({ redirect: "/sign-in", status: 302 });
    for (const method of ["get", "post"] as const) {
      const response = await request[method]("/account/invitations", {
        headers,
        maxRedirects: 0,
        ...(method === "post"
          ? {
              form: {
                intent: "send",
                userId: "00000000-0000-4000-8000-000000000000",
              },
            }
          : {}),
      });
      expect(response.status()).toBe(302);
      expect(response.headers().location).toBe("/sign-in");
    }
  }
});

test("owner invites, two accounts sign in, and revocation preserves the other account", async ({
  browser,
  page,
  baseURL,
}) => {
  test.setTimeout(45_000);
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const emailA = `mixedcase-${randomUUID()}@example.invalid`;
  const emailB = `second-${randomUUID()}@example.invalid`;
  const contextA = await browser.newContext({
    baseURL,
    storageState: { cookies: [], origins: [] },
  });
  const contextB = await browser.newContext({
    baseURL,
    storageState: { cookies: [], origins: [] },
  });
  try {
    // The verifier uses the existing owner login only to confirm server/database alignment.
    const legacy = await browser.newContext({
      baseURL,
      storageState: "playwright/.auth/user.json",
    });
    try {
      await verifyFixtureServerDatabase(legacy.request, pool);
    } finally {
      await legacy.close();
    }
    await pool.query(
      "insert into auth_users (id,name,email) values ($1,$2,$2) on conflict do nothing",
      [ownerId, ownerEmail],
    );
    const owner = await pool.query("select email from auth_users where id=$1", [
      ownerId,
    ]);
    expect(owner.rows[0]?.email).toBe(ownerEmail);
    await pool.query(
      "insert into auth_invitations (user_id,invited_by,expires_at,accepted_at) values ($1,$1,now(),now()) on conflict (user_id) do nothing",
      [ownerId],
    );
    await page.goto("/sign-in");
    await page
      .getByRole("textbox", { name: "Email", exact: true })
      .fill(ownerEmail);
    await page
      .getByRole("button", { name: "Email me a sign-in link", exact: true })
      .click();
    await expect(page.getByRole("status")).toBeVisible();
    await openLatestEmail(page, ownerEmail);
    const ownerMessage = (await messages())
      .filter((message) => message.to === ownerEmail)
      .at(-1);
    if (!ownerMessage) throw new Error("Missing owner fixture email");
    const callback = new URL(ownerMessage.url);
    const token = callback.searchParams.get("token");
    expect(
      (
        await page
          .context()
          .request.get(callback.toString(), { maxRedirects: 0 })
      ).status(),
    ).toBe(302);
    callback.searchParams.set(
      "callbackURL",
      `https://outside.example.invalid/?private=${token}`,
    );
    expect(
      (
        await page
          .context()
          .request.get(callback.toString(), { maxRedirects: 0 })
      ).status(),
    ).toBe(403);
    callback.searchParams.delete("callbackURL");
    callback.searchParams.set("token", "fixture-rejected-secret");
    expect(
      (
        await page
          .context()
          .request.get(callback.toString(), { maxRedirects: 0 })
      ).status(),
    ).toBe(302);
    await page
      .getByRole("link", { name: "Manage invitations", exact: true })
      .click();
    for (const email of [emailA.toUpperCase(), emailB]) {
      await page
        .getByRole("textbox", { name: "Email", exact: true })
        .fill(email);
      await page.getByRole("button", { name: "Invite", exact: true }).click();
      await expect(
        page.getByText(email.toLowerCase(), { exact: true }),
      ).toBeVisible();
    }
    const a = await contextA.newPage();
    const b = await contextB.newPage();
    await openLatestEmail(a, emailA);
    await openLatestEmail(b, emailB);
    const denied = await contextA.request.post("/account/invitations", {
      form: { intent: "invite", email: "attacker@example.invalid" },
      maxRedirects: 0,
    });
    expect(denied.status()).toBe(403);
    expect(
      (
        await contextA.request.get("/account/invitations", { maxRedirects: 0 })
      ).status(),
    ).toBe(403);
    for (const path of [
      "/nutrition",
      "/workouts",
      "/habits",
      "/api/exercises/history",
    ]) {
      expect(
        (await contextA.request.get(path, { maxRedirects: 0 })).status(),
      ).toBe(302);
    }
    const transaction = authorization(
      await discover(contextA.request),
      clients[0],
    );
    expect(
      (
        await contextA.request.get(transaction.url, { maxRedirects: 0 })
      ).status(),
    ).toBe(302);
    expect(
      (
        await contextA.request.post("/mcp", {
          data: { jsonrpc: "2.0", id: 1, method: "initialize", params: {} },
          maxRedirects: 0,
        })
      ).status(),
    ).toBe(401);
    await page
      .getByRole("button", { name: `Revoke ${emailA}`, exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: `Revoke ${emailA}`, exact: true }),
    ).toHaveCount(0);
    await a.reload();
    await expect(
      a.getByRole("button", { name: "Email me a sign-in link", exact: true }),
    ).toBeVisible();
    await b.reload();
    await expect(
      b.getByText(`Signed in as ${emailB}`, { exact: true }),
    ).toBeVisible();
    await page.setViewportSize({ width: 320, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await b.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(
      b.getByRole("button", { name: "Email me a sign-in link", exact: true }),
    ).toBeVisible();
    if (process.env.E2E_SERVER_LOG && token) {
      const log = await readFile(process.env.E2E_SERVER_LOG, "utf8");
      expect(log).toContain("GET /api/auth/magic-link/verify 403");
      expect(log).toContain("GET /api/auth/magic-link/verify 302");
      for (const secret of [
        token,
        "fixture-rejected-secret",
        ...(await messages())
          .filter((message) => [emailA, emailB].includes(message.to))
          .map((message) => new URL(message.url).searchParams.get("token"))
          .filter(Boolean),
      ])
        expect(log.includes(secret ?? "")).toBe(false);
    }
  } finally {
    await contextA.close();
    await contextB.close();
    await pool.query(
      "delete from auth_verifications where value::jsonb->>'email'=any($1::text[])",
      [[emailA, emailB]],
    );
    await pool.query("delete from auth_users where email=any($1::text[])", [
      [emailA, emailB],
    ]);
    await pool.end();
  }
});

test("uninvited sign-in is neutral and creates no account or email", async ({
  page,
  browser,
  baseURL,
}) => {
  const email = `unknown-${randomUUID()}@example.invalid`;
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const legacy = await browser.newContext({
    baseURL,
    storageState: "playwright/.auth/user.json",
  });
  try {
    await verifyFixtureServerDatabase(legacy.request, pool);
    await page.goto("/sign-in");
    await page.getByRole("textbox", { name: "Email", exact: true }).fill(email);
    await page
      .getByRole("button", { name: "Email me a sign-in link", exact: true })
      .click();
    await expect(page.getByRole("status")).toHaveText(
      "If you have an account, you’ll receive a sign-in link.",
    );
    expect((await messages()).some((message) => message.to === email)).toBe(
      false,
    );
    expect(
      (await pool.query("select id from auth_users where email=$1", [email]))
        .rows,
    ).toHaveLength(0);
  } finally {
    await legacy.close();
    await pool.query(
      "delete from auth_verifications where value::jsonb->>'email'=$1",
      [email],
    );
    await pool.end();
  }
});

test("owner can resend an invitation after local email delivery fails", async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(45_000);
  if (!inbox) throw new Error("Missing local inbox path");
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const email = `recovery-${randomUUID()}@a-long-invitation-address-for-phone-wrapping.example.invalid`;
  const backup = `${inbox}.recovery-${randomUUID()}`;
  let backedUp = false;
  let directoryInstalled = false;
  const legacy = await browser.newContext({
    baseURL,
    storageState: "playwright/.auth/user.json",
  });
  const inviteeContext = await browser.newContext({
    baseURL,
    storageState: { cookies: [], origins: [] },
  });
  const restoreInbox = async () => {
    if (directoryInstalled) {
      await rm(inbox, { recursive: true });
      directoryInstalled = false;
    }
    if (backedUp) {
      await rename(backup, inbox);
      backedUp = false;
    }
  };
  try {
    await verifyFixtureServerDatabase(legacy.request, pool);
    await pool.query(
      "insert into auth_users (id,name,email) values ($1,$2,$2) on conflict do nothing",
      [ownerId, ownerEmail],
    );
    await pool.query(
      "insert into auth_invitations (user_id,invited_by,expires_at,accepted_at) values ($1,$1,now(),now()) on conflict (user_id) do nothing",
      [ownerId],
    );
    await page.goto("/sign-in");
    await page
      .getByRole("textbox", { name: "Email", exact: true })
      .fill(ownerEmail);
    await page
      .getByRole("button", { name: "Email me a sign-in link", exact: true })
      .click();
    await expect(page.getByRole("status")).toBeVisible();
    await openLatestEmail(page, ownerEmail);
    await page
      .getByRole("link", { name: "Manage invitations", exact: true })
      .click();
    await rename(inbox, backup);
    backedUp = true;
    await mkdir(inbox);
    directoryInstalled = true;
    await page.setViewportSize({ width: 320, height: 844 });
    await page.getByRole("textbox", { name: "Email", exact: true }).fill(email);
    await page.getByRole("button", { name: "Invite", exact: true }).click();
    await expect(page.getByRole("alert")).toHaveText(
      "Invitation created, but the email could not be sent. Use Resend email to try again.",
    );
    await expect(page.getByText(email, { exact: true })).toBeVisible();
    const resend = page.getByRole("button", {
      name: `Resend email to ${email}`,
      exact: true,
    });
    await expect(resend).toBeVisible();
    const invitation = await pool.query(
      "select u.id, i.accepted_at, i.revoked_at from auth_users u join auth_invitations i on i.user_id=u.id where u.email=$1",
      [email],
    );
    expect(invitation.rows).toHaveLength(1);
    expect(invitation.rows[0]).toMatchObject({
      accepted_at: null,
      revoked_at: null,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await resend.click();
    await expect(page.getByRole("alert")).toHaveText(
      "Could not send the email. Use Resend email to try again.",
    );
    await restoreInbox();
    await resend.click();
    await expect(page.getByRole("alert")).toHaveCount(0);
    const invitee = await inviteeContext.newPage();
    await openLatestEmail(invitee, email);
    await page.reload();
    await expect(resend).toHaveCount(0);
    const admitted = await pool.query(
      "select i.accepted_at from auth_invitations i join auth_users u on u.id=i.user_id where u.email=$1",
      [email],
    );
    expect(admitted.rows).toHaveLength(1);
    expect(admitted.rows[0].accepted_at).not.toBeNull();
  } finally {
    await restoreInbox();
    await legacy.close();
    await inviteeContext.close();
    await pool.query(
      "delete from auth_verifications where value::jsonb->>'email'=$1",
      [email],
    );
    await pool.query("delete from auth_users where email=$1", [email]);
    await pool.end();
  }
});
