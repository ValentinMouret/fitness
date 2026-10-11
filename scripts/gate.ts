#!/usr/bin/env bun
/**
 * The gate: every check that guards main, run the same way locally and in CI.
 *
 * It builds its own environment instead of reading the developer's shell or
 * .env, creates throwaway databases, and runs independent stages in parallel.
 * The only input is GATE_POSTGRES_URL, an admin connection to PostgreSQL.
 */
import { type ChildProcess, execFileSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createWriteStream, mkdirSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { availableParallelism, userInfo } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { Client } from "pg";

const adminUrl =
  process.env.GATE_POSTGRES_URL ?? "postgresql://localhost/postgres";
const keepDatabases = process.env.GATE_KEEP_DATABASES === "1";
const runId = randomBytes(3).toString("hex");
const logDir = ".gate";
const ownerId = "720cbf7c-67b5-4d6b-b026-c8e1099ff435";

// The image runs these versions; tools such as Playwright break on others.
const toolchain = [
  ["node", ".node-version", (v: string) => v.replace(/^v/, "")],
  ["bun", ".bun-version", (v: string) => v],
] as const;
for (const [tool, file, parse] of toolchain) {
  const pinned = readFileSync(file, "utf8").trim();
  const actual = parse(
    execFileSync(tool, ["--version"], { encoding: "utf8" }).trim(),
  );
  if (actual !== pinned && !actual.startsWith(`${pinned}.`)) {
    console.error(`✗ ${tool} ${actual} does not match ${file} (${pinned})`);
    process.exit(1);
  }
}

rmSync(logDir, { recursive: true, force: true });
mkdirSync(logDir, { recursive: true });

const databaseUrl = (name: string) => {
  const url = new URL(adminUrl);
  url.pathname = `/${name}`;
  // Name the role explicitly: containers and children have different users.
  if (!url.username) url.username = userInfo().username;
  return url.toString();
};
const databases = {
  unit: `fitness_gate_${runId}_unit_test`,
  e2e: `fitness_gate_${runId}_e2e_test`,
  native: `fitness_gate_${runId}_native_test`,
} as const;

const gitSha = execFileSync("git", ["rev-parse", "HEAD"]).toString().trim();

/** Everything a step sees. Nothing comes from the caller's shell or .env. */
const baseEnv: Record<string, string> = {
  PATH: process.env.PATH ?? "",
  HOME: process.env.HOME ?? "",
  // Identity, not configuration: PostgreSQL's default role comes from USER.
  USER: process.env.USER ?? "",
  LOGNAME: process.env.LOGNAME ?? "",
  TMPDIR: process.env.TMPDIR ?? "/tmp",
  ...(process.env.PLAYWRIGHT_BROWSERS_PATH
    ? { PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH }
    : {}),
  GATE: "1",
  NODE_ENV: "test",
  TZ: "UTC",
  // A locale that exists everywhere; PostgreSQL refuses to start without one.
  LC_ALL: "C",
  NODE_NO_WARNINGS: "1",
  FORCE_COLOR: "0",
  GIT_SHA: gitSha,
  DATABASE_URL: databaseUrl(databases.unit),
  ANTHROPIC_API_KEY: "dummy_key",
  AUTH_USERNAME: "testuser",
  AUTH_PASSWORD: "testpassword",
  E2E_AUTH_USERNAME: "testuser",
  E2E_AUTH_PASSWORD: "testpassword",
  AUTH_SESSION_SECRET: "gate-only-session-secret-not-for-production-32-bytes",
  AUTH_FOUNDATION_ENABLED: "false",
  AUTH_FOUNDATION_OWNER_USER_ID: ownerId,
  // Browser suites override the issuer with their server's origin.
  OAUTH_ISSUER_URL: "http://127.0.0.1",
  OAUTH_CLIENTS: JSON.stringify([
    {
      name: "ChatGPT",
      id: "fitness-e2e-chatgpt",
      secret: "fitness-e2e-chatgpt-secret",
      redirectUri: "https://chatgpt.example.invalid/callback",
    },
    {
      name: "Claude",
      id: "fitness-e2e-claude",
      secret: "fitness-e2e-claude-secret",
      redirectUri: "https://claude.example.invalid/callback",
    },
  ]),
  E2E_CONNECTIONS_TABLE: "public.oauth_connections",
  E2E_AUTHORIZATION_CODES_TABLE: "public.oauth_authorization_codes",
  E2E_TOKENS_TABLE: "public.oauth_tokens",
  NUTRITION_TEST_DATABASE_URL: databaseUrl(databases.unit),
  AUTH_TEST_ADMIN_URL: adminUrl,
  TENANT_TEST_ADMIN_URL: adminUrl,
  MCP_TEST_ADMIN_URL: adminUrl,
};

interface Result {
  readonly name: string;
  readonly ok: boolean;
  readonly seconds: number;
}
const results: Result[] = [];
const servers: ChildProcess[] = [];

/** Starts a command with the gate environment, writing its output to a log. */
function start(
  command: ReadonlyArray<string>,
  env: Record<string, string>,
  logName: string,
): ChildProcess {
  const [program, ...args] = command;
  const log = createWriteStream(join(logDir, logName));
  const child = spawn(program, args, {
    env: { ...baseEnv, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout?.pipe(log, { end: false });
  child.stderr?.pipe(log, { end: false });
  child.on("close", () => log.end());
  return child;
}

/** Runs one command, logging to .gate/<name>.log. */
async function run(
  name: string,
  command: ReadonlyArray<string>,
  env: Record<string, string> = {},
): Promise<boolean> {
  const started = performance.now();
  const child = start(command, env, `${name}.log`);
  const ok = await new Promise<boolean>((resolve) =>
    child.on("close", (code) => resolve(code === 0)),
  );
  const seconds = (performance.now() - started) / 1000;
  results.push({ name, ok, seconds });
  console.log(`${ok ? "✓" : "✗"} ${name} (${seconds.toFixed(0)}s)`);
  return ok;
}

/** Runs steps one after another, stopping at the first failure. */
const sequence =
  (...steps: ReadonlyArray<() => Promise<boolean>>) =>
  async () => {
    for (const step of steps) if (!(await step())) return false;
    return true;
  };

const parallel = async (...steps: ReadonlyArray<() => Promise<boolean>>) =>
  (await Promise.all(steps.map((step) => step()))).every(Boolean);

/**
 * Browsers, servers and containers each need about two cores. Running more of
 * them than the machine holds makes every timing-based assertion a coin flip.
 */
const heavySlots = Math.max(1, Math.floor(availableParallelism() / 2));
let heavyRunning = 0;
const heavyWaiting: Array<() => void> = [];
const heavy = (step: () => Promise<boolean>) => async (): Promise<boolean> => {
  if (heavyRunning < heavySlots) heavyRunning++;
  else await new Promise<void>((resume) => heavyWaiting.push(resume));
  try {
    return await step();
  } finally {
    // Hand the slot straight to the next waiter, or free it.
    const next = heavyWaiting.shift();
    if (next) next();
    else heavyRunning--;
  }
};

async function withAdmin<T>(use: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: adminUrl });
  await client.connect();
  try {
    return await use(client);
  } finally {
    await client.end();
  }
}

const createDatabases = () =>
  withAdmin(async (client) => {
    for (const name of Object.values(databases))
      await client.query(`create database ${name}`);
  });

const dropDatabases = () =>
  withAdmin(async (client) => {
    for (const name of Object.values(databases))
      await client.query(`drop database if exists ${name} with (force)`);
  });

/** Migrates and seeds a database the way a fresh environment starts. */
const prepare = (role: keyof typeof databases) => {
  const env = {
    DATABASE_URL: databaseUrl(databases[role]),
    AUTH_LOCAL_DATABASE_URL: databaseUrl(databases[role]),
  };
  return sequence(
    () => run(`db-migrate-${role}`, ["bun", "run", "db:migrate"], env),
    () => run(`db-auth-seed-${role}`, ["bun", "run", "auth:seed-local"], env),
    () => run(`db-seed-${role}`, ["bun", "run", "db:seed"], env),
  );
};

const freePort = () =>
  new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() =>
        typeof address === "object" && address
          ? resolve(address.port)
          : reject(new Error("No free port")),
      );
    });
  });

async function waitFor(url: string): Promise<boolean> {
  for (let attempt = 0; attempt < 150; attempt++) {
    try {
      if ((await fetch(url)).ok) return true;
    } catch {
      // Not listening yet.
    }
    await sleep(200);
  }
  return false;
}

/** Starts the production build against a database, runs Playwright, stops it. */
async function browserSuite(
  name: string,
  role: "e2e" | "native",
  readyPath: string,
  playwrightArgs: ReadonlyArray<string>,
  extraEnv: Record<string, string>,
): Promise<boolean> {
  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  const env = {
    ...extraEnv,
    DATABASE_URL: databaseUrl(databases[role]),
    E2E_DATABASE_URL: databaseUrl(databases[role]),
    E2E_ALLOW_FIXTURE_WRITES: "true",
    E2E_BASE_URL: origin,
    OAUTH_ISSUER_URL: origin,
    AUTH_FOUNDATION_ORIGIN: origin,
    AUTH_LOCAL_INBOX: join(process.cwd(), logDir, `${role}-inbox.jsonl`),
    HOST: "127.0.0.1",
    PORT: String(port),
  };
  const server = start(["bun", "run", "start"], env, `${name}-server.log`);
  servers.push(server);
  try {
    if (!(await waitFor(`${origin}${readyPath}`))) {
      console.log(`✗ ${name}: server did not start (see ${name}-server.log)`);
      results.push({ name, ok: false, seconds: 0 });
      return false;
    }
    return await run(
      name,
      [
        "bunx",
        "playwright",
        "test",
        ...playwrightArgs,
        "--output",
        join(logDir, `${name}-results`),
      ],
      { ...env, PLAYWRIGHT_HTML_OUTPUT_DIR: join(logDir, `${name}-report`) },
    );
  } finally {
    server.kill();
  }
}

async function main(): Promise<boolean> {
  const started = performance.now();
  console.log(`Gate ${runId}: logs in ${logDir}/`);
  await createDatabases();

  const staticChecks = parallel(
    () => run("format-lint", ["bunx", "biome", "ci", "."]),
    () => run("import-boundaries", ["bun", "run", "lint:boundaries"]),
    () => run("type-assertions", ["bun", "run", "lint:type-assertions"]),
    () => run("typecheck", ["bun", "run", "typecheck"]),
    sequence(
      () => run("schema-check", ["bunx", "drizzle-kit", "check"]),
      () => run("migration-drift", ["bash", "scripts/check-migrations.sh"]),
    ),
  );
  const ready = parallel(
    // Build what the image ships: NODE_ENV=test would bundle React's dev build.
    () => run("build", ["bun", "run", "build"], { NODE_ENV: "production" }),
    prepare("unit"),
    prepare("e2e"),
    prepare("native"),
  );
  const [staticOk, readyOk] = await Promise.all([staticChecks, ready]);
  const testsOk = readyOk && (await tests());
  return report(started) && staticOk && testsOk;
}

/** Suites that need only processes and PostgreSQL. */
const services = () =>
  parallel(
    () => run("unit", ["bun", "run", "test"]),
    sequence(
      () =>
        run("integration-nutrition", [
          "bun",
          "run",
          "test:nutrition:integration",
        ]),
      heavy(() =>
        run("integration-auth", ["bun", "run", "test:auth:integration"]),
      ),
      () =>
        run("integration-tenant", ["bun", "run", "test:tenant:integration"]),
      () => run("integration-mcp", ["bun", "run", "test:mcp:integration"]),
    ),
  );

/** Suites that drive Chromium. Longest first, so few slots finish early. */
const browsers = () =>
  parallel(
    heavy(() => browserSuite("e2e", "e2e", "/login", [], {})),
    heavy(() =>
      browserSuite(
        "e2e-native",
        "native",
        "/sign-in",
        ["--config", "playwright.native.config.ts"],
        { AUTH_FOUNDATION_ENABLED: "true" },
      ),
    ),
    heavy(() =>
      run("mcp-acceptance", [
        "bunx",
        "vitest",
        "run",
        "--config",
        "vitest.mcp-acceptance.config.ts",
      ]),
    ),
    heavy(() => run("browser-components", ["bun", "run", "test:browser"])),
  );

/** The production image: build, runtime migrations, asset retention. */
const image = heavy(
  sequence(
    () => run("image-build", ["docker", "build", "--tag", "fitness-gate", "."]),
    // The entrypoint applies migrations before running the command.
    () =>
      run("image-migrations", [
        "docker",
        "run",
        "--rm",
        "--network",
        "host",
        "-e",
        `DATABASE_URL=${databaseUrl(databases.unit)}`,
        "-e",
        "ANTHROPIC_API_KEY=dummy_key",
        "-e",
        "AUTH_USERNAME=testuser",
        "-e",
        "AUTH_PASSWORD=testpassword",
        "-e",
        `AUTH_SESSION_SECRET=${baseEnv.AUTH_SESSION_SECRET}`,
        "-e",
        "NODE_ENV=production",
        "fitness-gate",
        "bun",
        "-e",
        'console.log("Runtime migration smoke check passed")',
      ]),
    () => run("image-retention", ["bash", "deploy/test-retention.sh"]),
  ),
);

/**
 * On Linux, Docker adds network interfaces to the host for builds and
 * containers, and Chromium aborts every in-flight request on a network change
 * (net::ERR_NETWORK_CHANGED). Elsewhere Docker runs in a VM, so all overlap.
 */
const dockerSharesHostNetwork = process.platform === "linux";
const tests = async () => {
  if (!dockerSharesHostNetwork) return parallel(services, browsers, image);
  const first = await parallel(services, image);
  return (await browsers()) && first;
};

/** Prints the outcome and the end of each failed step's log. */
function report(started: number): boolean {
  const failed = results.filter((result) => !result.ok);
  console.log(
    `\n${failed.length ? "✗ Gate failed" : "✓ Gate passed"} in ${((performance.now() - started) / 1000).toFixed(0)}s`,
  );
  for (const { name } of failed) {
    const lines = readFileSync(join(logDir, `${name}.log`), "utf8")
      .trimEnd()
      .split("\n");
    console.log(`\n── ${name} (last 40 lines of ${logDir}/${name}.log)`);
    console.log(lines.slice(-40).join("\n"));
  }
  return failed.length === 0;
}

const cleanup = async () => {
  for (const server of servers) server.kill();
  if (!keepDatabases) await dropDatabases().catch(() => undefined);
};
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, async () => {
    await cleanup();
    process.exit(130);
  });

const ok = await main().catch((error: unknown) => {
  console.error(error);
  return false;
});
await cleanup();
process.exit(ok ? 0 : 1);
