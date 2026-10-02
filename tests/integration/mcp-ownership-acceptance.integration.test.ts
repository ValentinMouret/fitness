import { type ChildProcess, execFile, spawn } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  StreamableHTTPClientTransport,
  StreamableHTTPError,
} from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { OAuthTokens } from "@modelcontextprotocol/sdk/shared/auth.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { hashCredential } from "../../app/modules/auth/infra/crypto.server";
import { provisionReader } from "../../app/modules/mcp/infra/provision-reader.server";
import { createDisposablePostgres } from "./support/disposable-postgres";

const run = promisify(execFile);
const freePort = async () => {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test port");
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return address.port;
};
const owner = randomUUID();
const other = randomUUID();
const connection = randomUUID();
const ownWorkout = randomUUID();
const legacyExercise = randomUUID();
const foreignWorkout = randomUUID();
const foreignIngredient = randomUUID();
const access = randomBytes(32).toString("base64url");
const refresh = randomBytes(32).toString("base64url");
const foreignAccess = randomBytes(32).toString("base64url");
const clientId = "fitness-sdk-acceptance";
const clientSecret = randomBytes(32).toString("base64url");
let folder: string;
let clusterStarted = false;
let fixture: ReturnType<typeof createDisposablePostgres> | undefined;
let app: ChildProcess | undefined;
let origin = "";
let client: Client | undefined;
let saved: OAuthTokens = {
  access_token: access,
  refresh_token: refresh,
  token_type: "Bearer",
  scope: "fitness",
};
let savedCount = 0;
const databaseFixture = () => {
  if (!fixture) throw new Error("Acceptance database is not ready");
  return fixture;
};
const sdk = (token: string) => {
  const value = new Client({ name: "fitness-isolated-sdk", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(
    new URL(`${origin}/mcp`),
    {
      requestInit: { headers: { Authorization: `Bearer ${token}` } },
    },
  );
  return { value, transport };
};
const payload = (result: unknown) =>
  z
    .object({
      isError: z.boolean().optional(),
      structuredContent: z.record(z.string(), z.unknown()),
    })
    .parse(result);
const tokenPost = (path: string, params: Readonly<Record<string, string>>) =>
  fetch(`${origin}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams(params),
  });

async function nativeCookie(email: string): Promise<string> {
  const requested = await fetch(`${origin}/sign-in`, {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ intent: "request-link", email }),
  });
  expect(requested.status).toBe(200);
  const messages = (await readFile(join(folder, "inbox.jsonl"), "utf8"))
    .trim()
    .split("\n")
    .map((line) =>
      z.object({ to: z.string(), url: z.url() }).parse(JSON.parse(line)),
    );
  const message = messages.findLast((entry) => entry.to === email);
  if (!message) throw new Error("Native link missing");
  const verified = await fetch(message.url, { redirect: "manual" });
  expect(verified.status).toBe(302);
  return verified.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
}

beforeAll(async () => {
  folder = await mkdtemp(join(tmpdir(), "fitness-sdk-acceptance-"));
  const pgPort = await freePort();
  const httpPort = await freePort();
  origin = `http://127.0.0.1:${httpPort}`;
  await run(
    "initdb",
    [
      "-D",
      join(folder, "data"),
      "-U",
      "postgres",
      "-A",
      "trust",
      "--no-locale",
    ],
    { timeout: 30000 },
  );
  await run(
    "pg_ctl",
    [
      "-D",
      join(folder, "data"),
      "-l",
      join(folder, "postgres.log"),
      "-o",
      `-h 127.0.0.1 -p ${pgPort} -k ${folder}`,
      "-w",
      "start",
    ],
    { timeout: 15000 },
  );
  clusterStarted = true;
  fixture = createDisposablePostgres(
    new URL(`postgresql://postgres@127.0.0.1:${pgPort}/postgres`),
  );
  await fixture.create();
  await fixture.migrateBefore(13);
  await fixture.pool.query(
    "alter table workouts rename constraint workouts_template_id_workout_templates_id_fk to workouts_template_id_fkey",
  );
  await fixture.pool.query(
    "insert into habits (name,description,start_date,frequency_type,target_count,deleted_at) values ('Restored private habit','Retained legacy note','1900-01-01','daily',1,'1900-01-02')",
  );
  await fixture.pool.query(
    "insert into oauth_connections (id,client_id,resource,scope) values ($1,$2,$3,'fitness')",
    [connection, clientId, `${origin}/mcp`],
  );
  await fixture.pool.query(
    "insert into oauth_tokens (connection_id,access_hash,refresh_hash,access_expires_at,refresh_expires_at) values ($1,$2,$3,now()+interval '1 hour',now()+interval '1 day')",
    [connection, hashCredential(access), hashCredential(refresh)],
  );
  await fixture.pool.query(
    "insert into workouts (id,name,start) values ($1,'Retained owner workout','1900-01-01')",
    [ownWorkout],
  );
  const before = (await fixture.pool.query("select * from oauth_tokens")).rows;
  await fixture.pool.query(
    "insert into exercises(id,name,type,movement_pattern,description,mmc_instructions) values ($1,'Retained legacy lift','dumbbells','push','Retained private description','Retained private cue')",
    [legacyExercise],
  );
  await fixture.pool.query(
    "insert into exercise_muscle_groups(exercise,muscle_group,split) values($1,'pecs',100)",
    [legacyExercise],
  );
  const rehearsalEnv = {
    ...process.env,
    OWNERSHIP_REHEARSAL_DATABASE_URL: fixture.databaseUrl.toString(),
    OWNERSHIP_REHEARSAL_OWNER_ID: owner,
    OWNERSHIP_REHEARSAL_OWNER_EMAIL: "owner@example.invalid",
    OWNERSHIP_REHEARSAL_ARTIFACT_DIR: folder,
  };
  const preflight = await run("bun", ["scripts/rehearse-ownership.ts"], {
    env: rehearsalEnv,
    timeout: 15000,
  });
  expect(
    z
      .object({
        mode: z.literal("read-only preflight"),
        pendingMigrations: z.literal(8),
      })
      .parse(JSON.parse(preflight.stdout)).mode,
  ).toBe("read-only preflight");
  expect(
    (await fixture.pool.query("select count(*)::int as count from auth_users"))
      .rows,
  ).toEqual([{ count: 0 }]);
  const journalBefore = (
    await fixture.pool.query(
      "select id,hash,created_at from drizzle.__drizzle_migrations order by created_at",
    )
  ).rows;
  for (const [index, hash, createdAt] of [
    [0, "0000_spicy_randall_flagg", 1770755498152],
    [1, "0001_solid_doctor_doom", 1772781615263],
  ] as const)
    await fixture.pool.query(
      "update drizzle.__drizzle_migrations set hash=$1,created_at=$2 where id=$3",
      [hash, createdAt, journalBefore[index].id],
    );
  await fixture.pool.query(
    "alter table workout_template_exercises rename constraint workout_template_exercises_template_id_exercise_id_pk to workout_template_exercises_pk; alter table workout_template_exercises rename constraint workout_template_exercises_exercise_id_exercises_id_fk to workout_template_exercises_exercise_id_fkey; alter table workout_template_exercises rename constraint workout_template_exercises_template_id_workout_templates_id_fk to workout_template_exercises_template_id_fkey; alter table workout_template_sets rename constraint workout_template_sets_template_id_exercise_id_set_pk to workout_template_sets_pk; alter table workout_template_sets rename constraint workout_template_sets_exercise_id_exercises_id_fk to workout_template_sets_exercise_id_fkey; alter table workout_template_sets rename constraint workout_template_sets_template_id_workout_templates_id_fk to workout_template_sets_template_id_fkey",
  );
  const historicalJournal = (
    await fixture.pool.query(
      "select hash,created_at from drizzle.__drizzle_migrations order by created_at",
    )
  ).rows;
  const refusedChanges = [
    {
      change:
        "update drizzle.__drizzle_migrations set hash='0000_spicy_randall_flagh' where hash='0000_spicy_randall_flagg'",
      restore:
        "update drizzle.__drizzle_migrations set hash='0000_spicy_randall_flagg' where hash='0000_spicy_randall_flagh'",
      error: "Source migration journal does not match",
    },
    {
      change:
        "update drizzle.__drizzle_migrations set created_at=1772781615264 where hash='0001_solid_doctor_doom'",
      restore:
        "update drizzle.__drizzle_migrations set created_at=1772781615263 where hash='0001_solid_doctor_doom'",
      error: "Source migration journal does not match",
    },
    {
      change:
        "update drizzle.__drizzle_migrations set hash='9187eca34cbda7b1bba1eefe8360d95e37fac492390c020f0888fe19ad492b7d',created_at=1770881599790 where hash='0001_solid_doctor_doom'",
      restore:
        "update drizzle.__drizzle_migrations set hash='0001_solid_doctor_doom',created_at=1772781615263 where hash='9187eca34cbda7b1bba1eefe8360d95e37fac492390c020f0888fe19ad492b7d'",
      error: "Source migration journal does not match",
    },
    {
      change:
        "alter table generation_conversations alter column model drop not null",
      restore:
        "alter table generation_conversations alter column model set not null",
      error: "Unreviewed foundation schema fingerprint",
    },
    {
      change:
        "alter table workout_template_sets rename constraint workout_template_sets_template_id_fkey to unreviewed_template_fk",
      restore:
        "alter table workout_template_sets rename constraint unreviewed_template_fk to workout_template_sets_template_id_fkey",
      error: "Unreviewed foundation schema fingerprint",
    },
    {
      change:
        "alter index ingredients_name_unique_idx rename to unreviewed_food_index",
      restore:
        "alter index unreviewed_food_index rename to ingredients_name_unique_idx",
      error: "Unreviewed foundation schema fingerprint",
    },
    {
      change:
        "alter table workout_sets drop constraint rpe_range; alter table workout_sets add constraint rpe_range check (rpe is null or (rpe >= 5 and rpe <= 10))",
      restore:
        "alter table workout_sets drop constraint rpe_range; alter table workout_sets add constraint rpe_range check (rpe is null or (rpe >= 6 and rpe <= 10))",
      error: "Unreviewed foundation schema fingerprint",
    },
  ];
  for (const refused of refusedChanges) {
    await fixture.pool.query(refused.change);
    try {
      await expect(
        run("bun", ["scripts/rehearse-ownership.ts", "--apply"], {
          env: rehearsalEnv,
          timeout: 5000,
        }),
      ).rejects.toThrow(refused.error);
      expect(
        (
          await fixture.pool.query(
            "select count(*)::int as count from auth_users",
          )
        ).rows,
      ).toEqual([{ count: 0 }]);
      expect(
        (await readdir(folder)).filter((name) => name.startsWith("ownership-")),
      ).toEqual([]);
    } finally {
      await fixture.pool.query(refused.restore);
    }
  }
  const historicalPreflight = await run(
    "bun",
    ["scripts/rehearse-ownership.ts"],
    {
      env: rehearsalEnv,
      timeout: 15000,
    },
  );
  expect(JSON.parse(historicalPreflight.stdout).sourceJournal).toBe(
    "historical tag journal",
  );
  expect(
    (
      await fixture.pool.query(
        "select hash,created_at from drizzle.__drizzle_migrations order by created_at",
      )
    ).rows,
  ).toEqual(historicalJournal);
  for (const refused of [
    "postgresql://postgres@remote.invalid/fitness_ownership_rehearsal_test_copy",
    `${fixture.databaseUrl}?host=remote.invalid`,
    `${fixture.databaseUrl}#override`,
  ]) {
    await expect(
      run("bun", ["scripts/rehearse-ownership.ts", "--apply"], {
        env: { ...rehearsalEnv, OWNERSHIP_REHEARSAL_DATABASE_URL: refused },
        timeout: 5000,
      }),
    ).rejects.toThrow(
      "Only an explicitly named isolated loopback rehearsal/test copy is allowed",
    );
  }
  expect(
    (await fixture.pool.query("select count(*)::int as count from auth_users"))
      .rows,
  ).toEqual([{ count: 0 }]);
  const applied = await run(
    "bun",
    ["scripts/rehearse-ownership.ts", "--apply"],
    { env: rehearsalEnv, timeout: 30000 },
  );
  const artifacts = z
    .object({
      status: z.literal("preserved"),
      report: z.string(),
      backup: z.string(),
    })
    .parse(JSON.parse(applied.stdout.trim().split("\n").at(-1) ?? ""));
  const report = z
    .object({ before: z.array(z.unknown()), after: z.array(z.unknown()) })
    .parse(JSON.parse(await readFile(artifacts.report, "utf8")));
  expect(report.after).toEqual(report.before);
  expect(report.before).toHaveLength(25);
  expect(
    (
      await fixture.pool.query(
        "select hash,created_at from drizzle.__drizzle_migrations order by created_at limit 13",
      )
    ).rows,
  ).toEqual(historicalJournal);
  const recovery = createDisposablePostgres(
    new URL(`postgresql://postgres@127.0.0.1:${pgPort}/postgres`),
  );
  try {
    await recovery.create();
    const recoveryUrl = recovery.databaseUrl;
    await run(
      "pg_restore",
      [
        "--no-owner",
        "--exit-on-error",
        `--dbname=${recoveryUrl.pathname.slice(1)}`,
        artifacts.backup,
      ],
      {
        env: {
          ...process.env,
          PGHOST: "127.0.0.1",
          PGPORT: String(pgPort),
          PGUSER: "postgres",
          PGDATABASE: recoveryUrl.pathname.slice(1),
        },
        timeout: 15000,
      },
    );
    expect(
      (await recovery.pool.query("select * from oauth_tokens")).rows,
    ).toEqual(before);
    expect(
      (
        await recovery.pool.query(
          "select count(*)::int as count from auth_users",
        )
      ).rows,
    ).toEqual([{ count: 0 }]);
    expect(
      (await recovery.pool.query("select id,name from workouts")).rows,
    ).toEqual([{ id: ownWorkout, name: "Retained owner workout" }]);
    expect(
      (
        await recovery.pool.query(
          "select count(*)::int as count from drizzle.__drizzle_migrations",
        )
      ).rows,
    ).toEqual([{ count: 13 }]);
  } finally {
    await recovery.close();
  }
  expect((await fixture.pool.query("select * from oauth_tokens")).rows).toEqual(
    before,
  );
  expect(
    (await fixture.pool.query("select user_id,name,description from habits"))
      .rows,
  ).toEqual([
    {
      user_id: owner,
      name: "Restored private habit",
      description: "Retained legacy note",
    },
  ]);
  expect(
    (
      await fixture.pool.query(
        "select user_id from oauth_connections where id=$1",
        [connection],
      )
    ).rows,
  ).toEqual([{ user_id: owner }]);
  await fixture.pool.query(
    "insert into auth_users (id,name,email) values ($1,'Other account','other@example.invalid')",
    [other],
  );
  await fixture.pool.query(
    "insert into auth_invitations (user_id,invited_by,expires_at,accepted_at) values ($1,$2,now(),now())",
    [other, owner],
  );
  await fixture.pool.query(
    "insert into workouts (user_id,id,name,start) values ($1,$2,'Other private workout','1900-01-02')",
    [other, foreignWorkout],
  );
  await fixture.pool.query(
    "insert into ingredients (user_id,id,name,category,calories,protein,carbs,fat,fiber,water_percentage,energy_density,texture,slider_min,slider_max) values ($1,$2,'Other private ingredient','proteins',100,10,10,1,0,50,1,'firm_solid',5,500)",
    [other, foreignIngredient],
  );
  await fixture.pool.query(
    "with c as (insert into oauth_connections (user_id,client_id,resource,scope) values ($1,$2,$3,'fitness') returning id) insert into oauth_tokens (connection_id,access_hash,refresh_hash,access_expires_at,refresh_expires_at) select id,$4,$5,now()+interval '1 hour',now()+interval '1 day' from c",
    [
      other,
      clientId,
      `${origin}/mcp`,
      hashCredential(foreignAccess),
      hashCredential(randomBytes(32).toString("base64url")),
    ],
  );
  const reader = new URL(fixture.databaseUrl);
  reader.username = "fitness_mcp_reader";
  reader.password = randomUUID();
  await fixture.pool.query("revoke create on schema public from public");
  await provisionReader(fixture.databaseUrl.toString(), reader.toString());
  app = spawn(
    process.execPath,
    [
      "--require",
      "./server/request-logging.cjs",
      "./node_modules/@react-router/serve/bin.js",
      "./build/server/index.js",
    ],
    {
      env: {
        ...process.env,
        NODE_ENV: "test",
        HOST: "127.0.0.1",
        PORT: String(httpPort),
        DATABASE_URL: fixture.databaseUrl.toString(),
        MCP_DATABASE_URL: reader.toString(),
        AUTH_FOUNDATION_ENABLED: "true",
        AUTH_FOUNDATION_ORIGIN: origin,
        AUTH_LOCAL_INBOX: join(folder, "inbox.jsonl"),
        AUTH_FOUNDATION_OWNER_USER_ID: owner,
        AUTH_USERNAME: "test-owner",
        AUTH_PASSWORD: "test-password",
        AUTH_SESSION_SECRET: randomBytes(32).toString("hex"),
        OAUTH_ISSUER_URL: origin,
        OAUTH_CLIENTS: JSON.stringify([
          {
            id: clientId,
            name: "SDK acceptance",
            secret: clientSecret,
            redirectUri: "https://sdk.example.invalid/callback",
          },
        ]),
      },
      stdio: "ignore",
    },
  );
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (app.exitCode !== null)
      throw new Error("Acceptance app exited before ready; build first");
    try {
      if ((await fetch(`${origin}/healthz`)).ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Acceptance app did not become ready");
});
afterAll(async () => {
  await client?.close();
  if (app && app.exitCode === null) {
    const exited = new Promise<void>((resolve) =>
      app?.once("exit", () => resolve()),
    );
    app.kill("SIGTERM");
    await exited;
  }
  await fixture?.close();
  if (clusterStarted)
    await run(
      "pg_ctl",
      ["-D", join(folder, "data"), "-m", "fast", "-w", "stop"],
      { timeout: 15000 },
    );
  if (folder) await rm(folder, { recursive: true, force: true });
});

describe.sequential("full-stack external HTTP SDK ownership acceptance", () => {
  it("admits real native A/B sessions with independent dates and owner-only catalogue permissions", async () => {
    await databaseFixture().pool.query(
      "insert into measurements(user_id,name,unit,description) values($1,'weight','kg','Owner retained weight definition')",
      [owner],
    );
    for (const [id, email, zone, own, foreign] of [
      [
        owner,
        "owner@example.invalid",
        "Pacific/Auckland",
        ownWorkout,
        foreignWorkout,
      ],
      [
        other,
        "other@example.invalid",
        "America/Los_Angeles",
        foreignWorkout,
        ownWorkout,
      ],
    ] as const) {
      const cookie = await nativeCookie(email);
      const headers = {
        Cookie: cookie,
        Origin: origin,
        "Content-Type": "application/x-www-form-urlencoded",
      };
      const post = (path: string, form: Readonly<Record<string, string>>) =>
        fetch(`${origin}${path}`, {
          method: "POST",
          redirect: "manual",
          headers,
          body: new URLSearchParams(form),
        });
      const get = (path: string) =>
        fetch(`${origin}${path}`, {
          redirect: "manual",
          headers: { Cookie: cookie },
        });
      const session = await get("/api/auth/get-session");
      expect(
        z
          .object({ user: z.object({ id: z.string() }) })
          .parse(await session.json()).user.id,
      ).toBe(id);
      expect((await post("/account/timezone", { timeZone: zone })).status).toBe(
        200,
      );
      expect(
        (
          await databaseFixture().pool.query(
            "select time_zone from account_settings where user_id=$1",
            [id],
          )
        ).rows,
      ).toEqual([{ time_zone: zone }]);
      for (const path of [
        "/dashboard",
        "/habits",
        "/habits/week",
        "/measurements",
        "/workouts",
        `/workouts/${own}`,
        "/workouts/exercises",
        "/nutrition",
        "/nutrition/templates",
      ]) {
        const response = await get(path);
        expect(response.status, path).toBe(200);
        if (id === other) {
          const body = await response.text();
          expect(body).not.toContain("Retained private cue");
          expect(body).not.toContain("Retained private description");
          expect(body).not.toContain("Retained owner workout");
        }
      }
      for (const path of [
        `/workouts/${foreign}`,
        `/workouts/${foreign}/substitute/${legacyExercise}`,
      ]) {
        expect((await get(path)).status).toBe(404);
        expect(
          (
            await post(path, {
              intent: "update-name",
              name: "Cross-account bypass",
            })
          ).status,
        ).toBe(404);
      }
      for (const path of [
        "/workouts/exercises/create",
        `/workouts/exercises/${legacyExercise}/edit`,
      ]) {
        expect((await get(path)).status).toBe(id === owner ? 200 : 403);
        if (id === other)
          expect(
            (await post(path, { name: "Unapproved catalogue edit" })).status,
          ).toBe(403);
      }
      const definition = (
        await databaseFixture().pool.query(
          "select * from measurements where user_id=$1 and name='weight'",
          [id],
        )
      ).rows;
      if (id === other) expect(definition).toEqual([]);
      expect((await post("/dashboard", { weight: "76.123" })).status).toBe(200);
      expect(
        (
          await databaseFixture().pool.query(
            "select value from measures where user_id=$1 and measurement_name='weight' and value=76.123",
            [id],
          )
        ).rows,
      ).toEqual([{ value: 76.123 }]);
      if (id === other)
        expect(
          (
            await databaseFixture().pool.query(
              "select name,unit from measurements where user_id=$1 and name='weight'",
              [id],
            )
          ).rows,
        ).toEqual([{ name: "weight", unit: "kg" }]);
      if (id === owner)
        expect(
          (
            await databaseFixture().pool.query(
              "select * from measurements where user_id=$1 and name='weight'",
              [id],
            )
          ).rows,
        ).toEqual(definition);
      expect((await get("/dashboard")).status).toBe(200);
      const rejectedOrigin = await fetch(`${origin}/account/timezone`, {
        method: "POST",
        headers: { ...headers, Origin: "https://untrusted.invalid" },
        body: new URLSearchParams({ timeZone: "UTC" }),
      });
      expect(rejectedOrigin.status).toBe(403);
      const signedOut = await post("/logout", {});
      expect(signedOut.status).toBe(302);
      expect(signedOut.headers.get("Location")).toBe("/sign-in");
      expect((await get("/dashboard")).headers.get("Location")).toContain(
        "/sign-in",
      );
    }
  });

  it("native OAuth consent binds grants to actual A/B accounts and rejects account switching", async () => {
    const cookies = [
      await nativeCookie("owner@example.invalid"),
      await nativeCookie("other@example.invalid"),
    ];
    for (const [index, id] of [owner, other].entries()) {
      const cookie = cookies[index];
      const verifier = randomBytes(32).toString("base64url");
      const params = new URLSearchParams({
        response_type: "code",
        client_id: clientId,
        redirect_uri: "https://sdk.example.invalid/callback",
        resource: `${origin}/mcp`,
        scope: "fitness",
        code_challenge: createHash("sha256")
          .update(verifier)
          .digest("base64url"),
        code_challenge_method: "S256",
        state: "native-account-consent",
      });
      const consentResponse = await fetch(
        `${origin}/oauth/authorize?${params}`,
        { headers: { Cookie: cookie }, redirect: "manual" },
      );
      expect(consentResponse.status).toBe(200);
      const consent = /name="consent" value="([^"]+)"/.exec(
        await consentResponse.text(),
      )?.[1];
      if (!consent) throw new Error("Consent field missing");
      const grant = (actorCookie: string) =>
        fetch(`${origin}/oauth/authorize?${params}`, {
          method: "POST",
          redirect: "manual",
          headers: {
            Cookie: actorCookie,
            Origin: origin,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({ decision: "allow", consent }),
        });
      expect((await grant(cookies[1 - index])).status).toBe(400);
      const approved = await grant(cookie);
      expect(approved.status).toBe(303);
      const destination = new URL(approved.headers.get("Location") ?? "");
      const code = destination.searchParams.get("code");
      if (!code) throw new Error("Authorization code missing");
      const token = await tokenPost("/oauth/token", {
        grant_type: "authorization_code",
        code,
        redirect_uri: "https://sdk.example.invalid/callback",
        resource: `${origin}/mcp`,
        code_verifier: verifier,
      });
      expect(token.status).toBe(200);
      const issued = z
        .object({ access_token: z.string(), refresh_token: z.string() })
        .parse(await token.json());
      expect(
        (
          await databaseFixture().pool.query(
            "select c.user_id from oauth_tokens t join oauth_connections c on c.id=t.connection_id where t.access_hash=$1",
            [hashCredential(issued.access_token)],
          )
        ).rows,
      ).toEqual([{ user_id: id }]);
      const connected = sdk(issued.access_token);
      try {
        await connected.value.connect(connected.transport);
        const rows = payload(
          await connected.value.callTool({
            name: "query",
            arguments: { sql: "select id from fitness_data.workouts" },
          }),
        );
        expect(rows.structuredContent.rows).toEqual([
          { id: id === owner ? ownWorkout : foreignWorkout },
        ]);
      } finally {
        await connected.value.close();
      }
      expect(
        (
          await tokenPost("/oauth/revoke", {
            token: issued.refresh_token,
            token_type_hint: "refresh_token",
          })
        ).status,
      ).toBe(200);
    }
  });

  it("retains an owner credential across0013–0020 and scopes query and private writes", async () => {
    const connected = sdk(access);
    client = connected.value;
    await client.connect(connected.transport);
    const names = (await client.listTools()).tools.map((tool) => tool.name);
    expect(names).toContain("query");
    expect(names).toContain("create_workout");
    expect(names).toContain("log_meal");
    const createdExercise = payload(
      await client.callTool({
        name: "create_exercise",
        arguments: {
          name: "Reviewed neutral SDK exercise",
          type: "dumbbells",
          movementPattern: "push",
          description: "Private SDK description",
          mmcInstructions: "Private SDK cue",
          muscleGroupSplits: [{ muscleGroup: "pecs", split: 100 }],
        },
      }),
    );
    expect(createdExercise.isError).toBe(false);
    const createdExerciseId = z
      .object({ exercise: z.object({ id: z.uuid() }) })
      .parse(createdExercise.structuredContent).exercise.id;
    expect(
      (
        await databaseFixture().pool.query(
          "select description,mmc_instructions from exercises where id=$1",
          [createdExerciseId],
        )
      ).rows,
    ).toEqual([{ description: null, mmc_instructions: null }]);
    expect(
      (
        await databaseFixture().pool.query(
          "select user_id,description,mmc_instructions from exercise_preferences where exercise_id=$1",
          [createdExerciseId],
        )
      ).rows,
    ).toEqual([
      {
        user_id: owner,
        description: "Private SDK description",
        mmc_instructions: "Private SDK cue",
      },
    ]);
    expect(
      payload(
        await client.callTool({
          name: "query",
          arguments: {
            sql: `select description,mmc_instructions from fitness_data.exercises where id='${legacyExercise}'`,
          },
        }),
      ).structuredContent.rows,
    ).toEqual([
      {
        description: "Retained private description",
        mmc_instructions: "Retained private cue",
      },
    ]);
    const rows = payload(
      await client.callTool({
        name: "query",
        arguments: {
          sql: "select id,name from fitness_data.workouts order by id",
        },
      }),
    );
    expect(rows.isError).toBe(false);
    expect(rows.structuredContent.rows).toEqual([
      { id: ownWorkout, name: "Retained owner workout" },
    ]);
    const denied = payload(
      await client.callTool({
        name: "delete_workout",
        arguments: { workoutId: foreignWorkout },
      }),
    );
    expect(denied.isError).toBe(true);
    expect(denied.structuredContent.error).toMatchObject({ code: "not_found" });
    const meal = payload(
      await client.callTool({
        name: "log_meal",
        arguments: {
          loggedDate: "1900-01-03",
          mealCategory: "lunch",
          ingredients: [{ id: foreignIngredient, quantity: 100 }],
        },
      }),
    );
    expect(meal.isError).toBe(true);
    expect(meal.structuredContent.error).toMatchObject({ code: "not_found" });
    const created = payload(
      await client.callTool({
        name: "create_workout",
        arguments: { name: "SDK owned write", start: "1900-01-04T10:00:00Z" },
      }),
    );
    expect(created.isError).toBe(false);
    expect(
      (
        await databaseFixture().pool.query(
          "select user_id from workouts where name='SDK owned write'",
        )
      ).rows,
    ).toEqual([{ user_id: owner }]);
    expect(
      (
        await databaseFixture().pool.query(
          "select deleted_at from workouts where id=$1",
          [foreignWorkout],
        )
      ).rows,
    ).toEqual([{ deleted_at: null }]);
    expect(
      (
        await databaseFixture().pool.query(
          "select count(*)::int as count from meal_logs",
        )
      ).rows,
    ).toEqual([{ count: 0 }]);
    const createdIngredient = payload(
      await client.callTool({
        name: "create_ingredient",
        arguments: {
          name: "SDK own food",
          category: "proteins",
          calories: 100,
          protein: 10,
          carbs: 10,
          fat: 1,
          fiber: 0,
          waterPercentage: 50,
          energyDensity: 1,
          texture: "firm_solid",
          isVegetarian: true,
          isVegan: true,
        },
      }),
    );
    expect(createdIngredient.isError).toBe(false);
    const ownIngredient = z
      .object({ ingredient: z.object({ id: z.uuid() }) })
      .parse(createdIngredient.structuredContent).ingredient.id;
    const ownMeal = payload(
      await client.callTool({
        name: "log_meal",
        arguments: {
          loggedDate: "1900-01-03",
          mealCategory: "lunch",
          ingredients: [{ id: ownIngredient, quantity: 100 }],
        },
      }),
    );
    expect(ownMeal.isError).toBe(false);
    expect(
      (await databaseFixture().pool.query("select user_id from meal_logs"))
        .rows,
    ).toEqual([{ user_id: owner }]);
    const ingredientRows = payload(
      await client.callTool({
        name: "query",
        arguments: { sql: "select id,name from fitness_data.ingredients" },
      }),
    );
    expect(ingredientRows.structuredContent.rows).toEqual([
      { id: ownIngredient, name: "SDK own food" },
    ]);
  });
  it("admits B's actual SDK credential while keeping private reads and mutations scoped", async () => {
    const connected = sdk(foreignAccess);
    try {
      await connected.value.connect(connected.transport);
      const query = async (sql: string) =>
        payload(
          await connected.value.callTool({ name: "query", arguments: { sql } }),
        );
      expect(
        (await query("select id,name from fitness_data.workouts"))
          .structuredContent.rows,
      ).toEqual([{ id: foreignWorkout, name: "Other private workout" }]);
      expect(
        (
          await query(
            `select description,mmc_instructions from fitness_data.exercises where id='${legacyExercise}'`,
          )
        ).structuredContent.rows,
      ).toEqual([{ description: null, mmc_instructions: null }]);
      expect(
        (
          await query(
            `select id from fitness_data.workouts where id='${ownWorkout}'`,
          )
        ).structuredContent.rows,
      ).toEqual([]);
      const forbidden = payload(
        await connected.value.callTool({
          name: "delete_workout",
          arguments: { workoutId: ownWorkout },
        }),
      );
      expect(forbidden.isError).toBe(true);
      const canonical = payload(
        await connected.value.callTool({
          name: "create_exercise",
          arguments: {
            name: "B unapproved exercise",
            type: "barbell",
            movementPattern: "push",
            muscleGroupSplits: [{ muscleGroup: "pecs", split: 100 }],
          },
        }),
      );
      expect(canonical.isError).toBe(true);
      expect(
        (
          await databaseFixture().pool.query(
            "select id from exercises where name='B unapproved exercise'",
          )
        ).rows,
      ).toEqual([]);
      const created = payload(
        await connected.value.callTool({
          name: "create_workout",
          arguments: {
            name: "SDK B owned write",
            start: "1900-01-05T10:00:00Z",
          },
        }),
      );
      expect(created.isError).toBe(false);
      expect(
        (
          await databaseFixture().pool.query(
            "select user_id from workouts where name='SDK B owned write'",
          )
        ).rows,
      ).toEqual([{ user_id: other }]);
      await databaseFixture().pool.query(
        "update auth_invitations set revoked_at=now() where user_id=$1",
        [other],
      );
      try {
        await expect(connected.value.listTools()).rejects.toMatchObject({
          code: 401,
        });
      } finally {
        await databaseFixture().pool.query(
          "update auth_invitations set revoked_at=null where user_id=$1",
          [other],
        );
      }
    } finally {
      await connected.value.close();
    }
  });

  it("denies missing bearer and revoked owner identity before private tools", async () => {
    for (const token of ["", randomBytes(32).toString("base64url")]) {
      const attempt = sdk(token);
      try {
        await expect(
          attempt.value.connect(attempt.transport),
        ).rejects.toMatchObject({ code: 401 });
      } finally {
        await attempt.value.close();
      }
    }
    await databaseFixture().pool.query(
      "update auth_invitations set revoked_at=now() where user_id=$1",
      [owner],
    );
    try {
      const response = await fetch(`${origin}/mcp`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${access}`,
          Accept: "application/json, text/event-stream",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/list",
          params: {},
        }),
      });
      expect(response.status).toBe(401);
      expect(await response.text()).not.toContain("Other private");
    } finally {
      await databaseFixture().pool.query(
        "update auth_invitations set revoked_at=null where user_id=$1",
        [owner],
      );
    }
  });
  it("fails closed when accepted access has no self-bootstrapped owner identity", async () => {
    await databaseFixture().pool.query(
      "update auth_invitations set invited_by=$1 where user_id=$2",
      [other, owner],
    );
    try {
      const attempt = sdk(access);
      try {
        await expect(
          attempt.value.connect(attempt.transport),
        ).rejects.toMatchObject({ code: 503 });
      } finally {
        await attempt.value.close();
      }
    } finally {
      await databaseFixture().pool.query(
        "update auth_invitations set invited_by=$1 where user_id=$1",
        [owner],
      );
    }
  });
  it("SDK discovery refreshes the retained token, rejects replay and enforces revocation on an initialized client", async () => {
    await client?.close();
    await databaseFixture().pool.query(
      "update oauth_tokens set access_expires_at=now()-interval '1 second' where access_hash=$1",
      [hashCredential(access)],
    );
    const provider: OAuthClientProvider = {
      redirectUrl: "https://sdk.example.invalid/callback",
      clientMetadata: {
        redirect_uris: ["https://sdk.example.invalid/callback"],
        token_endpoint_auth_method: "client_secret_basic",
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        scope: "fitness",
      },
      clientInformation: () => ({
        client_id: clientId,
        client_secret: clientSecret,
      }),
      tokens: () => saved,
      saveTokens: (value) => {
        saved = value;
        savedCount++;
      },
      redirectToAuthorization: () => {
        throw new Error("Retained refresh must not require new consent");
      },
      saveCodeVerifier: () => {
        throw new Error("Unexpected new authorization flow");
      },
      codeVerifier: () => {
        throw new Error("Unexpected new authorization flow");
      },
    };
    client = new Client({
      name: "fitness-retained-oauth-sdk",
      version: "1.0.0",
    });
    await client.connect(
      new StreamableHTTPClientTransport(new URL(`${origin}/mcp`), {
        authProvider: provider,
      }),
    );
    expect(savedCount).toBe(1);
    expect(saved.access_token).not.toBe(access);
    expect(saved.refresh_token).not.toBe(refresh);
    expect((await client.listTools()).tools.length).toBeGreaterThan(0);
    const replayAccess = randomBytes(32).toString("base64url");
    const replayRefresh = randomBytes(32).toString("base64url");
    await databaseFixture().pool.query(
      "with c as (insert into oauth_connections (user_id,client_id,resource,scope) values ($1,$2,$3,'fitness') returning id) insert into oauth_tokens (connection_id,access_hash,refresh_hash,access_expires_at,refresh_expires_at) select id,$4,$5,now()+interval '1 hour',now()+interval '1 day' from c",
      [
        owner,
        clientId,
        `${origin}/mcp`,
        hashCredential(replayAccess),
        hashCredential(replayRefresh),
      ],
    );
    const rotated = await tokenPost("/oauth/token", {
      grant_type: "refresh_token",
      refresh_token: replayRefresh,
      resource: `${origin}/mcp`,
    });
    expect(rotated.status).toBe(200);
    const rotatedToken = z
      .object({ access_token: z.string() })
      .parse(await rotated.json());
    const replay = await tokenPost("/oauth/token", {
      grant_type: "refresh_token",
      refresh_token: replayRefresh,
      resource: `${origin}/mcp`,
    });
    expect(replay.status).toBe(400);
    expect(await replay.json()).toMatchObject({ error: "invalid_grant" });
    const replayClient = sdk(rotatedToken.access_token);
    try {
      await expect(
        replayClient.value.connect(replayClient.transport),
      ).rejects.toMatchObject({ code: 401 });
    } finally {
      await replayClient.value.close();
    }
    expect((await client.listTools()).tools.length).toBeGreaterThan(0);
    const revoked = await tokenPost("/oauth/revoke", {
      token: saved.refresh_token ?? "",
      token_type_hint: "refresh_token",
    });
    expect(revoked.status).toBe(200);
    await expect(client.listTools()).rejects.toThrow();
    const attempt = sdk(saved.access_token);
    try {
      await expect(attempt.value.connect(attempt.transport)).rejects.toThrow(
        StreamableHTTPError,
      );
    } finally {
      await attempt.value.close();
    }
  });
});
