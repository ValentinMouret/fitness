import { type ChildProcess, execFile, spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
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
import {
  UNSAFE_decodeViaTurboStream,
  UNSAFE_SingleFetchRedirectSymbol,
} from "react-router";
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
  it("keeps private routes closed to real native A/B sessions before identity cutover", async () => {
    for (const [id, email] of [
      [owner, "owner@example.invalid"],
      [other, "other@example.invalid"],
    ] as const) {
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
      if (!message) throw new Error("Native acceptance link was not delivered");
      const verified = await fetch(message.url, { redirect: "manual" });
      expect(verified.status).toBe(302);
      const cookie = verified.headers
        .getSetCookie()
        .map((value) => value.split(";")[0])
        .join("; ");
      expect(cookie).toContain("better-auth.session_token=");
      const session = await fetch(`${origin}/api/auth/get-session`, {
        headers: { Cookie: cookie },
      });
      expect(
        z
          .object({ user: z.object({ id: z.string() }) })
          .parse(await session.json()).user.id,
      ).toBe(id);
      const privatePages = [
        "/",
        "/dashboard",
        "/habits",
        "/habits/week",
        "/habits/new",
        `/habits/${randomUUID()}/edit`,
        "/measurements",
        "/measurements/new",
        "/measurements/weight",
        "/workouts",
        `/workouts/${ownWorkout}`,
        `/workouts/${foreignWorkout}`,
        `/workouts/${ownWorkout}/substitute/${legacyExercise}`,
        "/workouts/exercises",
        "/workouts/exercises/create",
        `/workouts/exercises/${legacyExercise}/edit`,
        "/nutrition",
        "/nutrition/templates",
        "/nutrition/meal-builder",
        "/nutrition/meals",
        "/nutrition/calculate-targets",
      ] as const;
      for (const path of [
        ...privatePages,
        ...privatePages.map((page) =>
          page === "/" ? "/_root.data" : `${page}.data`,
        ),
        `/api/exercises/history?exerciseId=${legacyExercise}`,
      ]) {
        const response = await fetch(`${origin}${path}`, {
          headers: { Cookie: cookie },
          redirect: "manual",
        });
        if (response.status === 202) {
          if (!response.body) throw new Error("Missing router response body");
          const decoded = await UNSAFE_decodeViaTurboStream(
            response.body,
            globalThis,
          );
          const result = z
            .custom<Record<symbol, unknown>>(
              (value) =>
                typeof value === "object" &&
                value !== null &&
                UNSAFE_SingleFetchRedirectSymbol in value,
            )
            .parse(decoded.value);
          expect(Object.keys(result)).toHaveLength(0);
          const redirect = z
            .object({ redirect: z.string(), status: z.number() })
            .parse(result[UNSAFE_SingleFetchRedirectSymbol]);
          expect(redirect.status).toBe(302);
          expect(new URL(redirect.redirect, origin).pathname).toBe("/login");
        } else {
          expect(response.status).toBe(302);
          expect(response.headers.get("Location")).toContain("/login");
        }
      }
      const authorization = new URLSearchParams({
        response_type: "code",
        client_id: clientId,
        redirect_uri: "https://sdk.example.invalid/callback",
        resource: `${origin}/mcp`,
        scope: "fitness",
        code_challenge: randomBytes(32).toString("base64url"),
        code_challenge_method: "S256",
        state: "native-admission-hold",
      });
      const beforeConsent = await databaseFixture().pool.query(
        "select (select count(*) from oauth_connections)::int as connections, (select count(*) from oauth_authorization_codes)::int as codes",
      );
      for (const method of ["GET", "POST"] as const) {
        const response = await fetch(
          `${origin}/oauth/authorize?${authorization}`,
          {
            method,
            redirect: "manual",
            headers: {
              Cookie: cookie,
              Origin: origin,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            ...(method === "POST"
              ? {
                  body: new URLSearchParams({
                    decision: "allow",
                    consent: "native-hold-invalid-ticket",
                  }),
                }
              : {}),
          },
        );
        expect(response.status).toBe(302);
        expect(response.headers.get("Location")).toContain("/login");
      }
      expect(
        (
          await databaseFixture().pool.query(
            "select (select count(*) from oauth_connections)::int as connections, (select count(*) from oauth_authorization_codes)::int as codes",
          )
        ).rows,
      ).toEqual(beforeConsent.rows);
      const before = await databaseFixture().pool.query(
        "select name from workouts where id=$1",
        [ownWorkout],
      );
      const privateActions = [
        "/dashboard",
        "/habits",
        "/habits/week",
        "/habits/new",
        `/habits/${randomUUID()}/edit`,
        "/measurements",
        "/measurements/new",
        "/measurements/weight",
        "/workouts/create",
        `/workouts/${ownWorkout}`,
        `/workouts/${ownWorkout}/substitute/${legacyExercise}`,
        "/workouts/exercises",
        "/workouts/exercises/create",
        `/workouts/exercises/${legacyExercise}/edit`,
        "/nutrition",
        "/nutrition/templates",
        "/nutrition/meal-builder",
        "/nutrition/meals",
        "/nutrition/calculate-targets",
        "/api/nutrition/estimate-meal",
      ] as const;
      for (const path of privateActions) {
        const mutation = await fetch(`${origin}${path}`, {
          method: "POST",
          redirect: "manual",
          headers: {
            Cookie: cookie,
            Origin: origin,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            intent: "update-name",
            name: "Native hold bypass",
          }),
        });
        expect(mutation.status).toBe(302);
        expect(mutation.headers.get("Location")).toContain("/login");
      }
      expect(
        (
          await databaseFixture().pool.query(
            "select name from workouts where id=$1",
            [ownWorkout],
          )
        ).rows,
      ).toEqual(before.rows);
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
  it("denies accepted B, missing bearer and revoked owner identity before private tools", async () => {
    for (const token of [
      foreignAccess,
      "",
      randomBytes(32).toString("base64url"),
    ]) {
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
