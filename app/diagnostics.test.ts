import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import {
  diagnosticCategory,
  diagnosticEventSchema,
  diagnosticRoute,
  statusCategory,
} from "./diagnostics";

const execute = promisify(execFile);
const event = {
  diagnostic_version: 1,
  event_id: "a07caed4-4b49-48dd-bf65-08c161b37b91",
  request_id: "d0a9e792-3b79-48d9-b706-7a046426dc84",
  release: "a".repeat(40),
  event: "request.complete",
  severity: "info",
  outcome: "ok",
  duration_ms: 1,
  category: "none",
};
describe("safe diagnostic boundaries", () => {
  it("does not label events with an unverified release", async () => {
    const { stdout, stderr } = await execute(
      process.execPath,
      ["--import", "tsx", "tests/fixtures/diagnostics.ts", "unknown-release"],
      {
        env: { ...process.env, NODE_ENV: "production", GIT_SHA: "unknown" },
        maxBuffer: 256 * 1024,
      },
    );
    expect(stdout).toContain("release_missing");
    expect(stdout).not.toContain("diagnostic_version");
    expect(stdout + stderr).not.toContain(
      "private-health-token-email@example.invalid",
    );
  });
  it("rejects extra or unbounded fields and unpinned source/tool identifiers", () => {
    expect(diagnosticEventSchema.safeParse(event).success).toBe(true);
    for (const fields of [
      { email: "private@example.invalid" },
      { err: { query: "private" } },
      { duration_ms: Infinity },
      { duration_ms: -1 },
      { duration_ms: 3_600_001 },
      { release: "unknown" },
      { tool: "private" },
      { route_id: "/workouts/private" },
      { request_id: "caller-id" },
    ]) {
      expect(
        diagnosticEventSchema.safeParse({ ...event, ...fields }).success,
      ).toBe(false);
    }
  });
  it("maps known paths without collecting values or query strings", () => {
    expect(
      diagnosticRoute("http://localhost/workouts/private.data?token=secret"),
    ).toBe("/workouts/:id");
    expect(
      diagnosticRoute("http://localhost/workouts/exercises/private/edit"),
    ).toBe("/workouts/exercises/:exercise-id/edit");
    expect(
      diagnosticRoute(
        "http://localhost/api/auth/magic-link/verify?token=secret",
      ),
    ).toBe("/api/auth/*");
    expect(
      diagnosticRoute("http://localhost/unregistered/private"),
    ).toBeUndefined();
  });
  it("separates expected rejection, dependency, timeout and unknown failures", () => {
    expect(
      diagnosticCategory({ code: "invalid_input", message: "private" }),
    ).toBe("validation");
    expect(diagnosticCategory({ code: "database_error" })).toBe("dependency");
    expect(diagnosticCategory({ code: "57014" })).toBe("timeout");
    expect(diagnosticCategory(new Error("private"))).toBe("unexpected");
    expect(statusCategory(401)).toBe("unauthenticated");
    expect(statusCategory(403)).toBe("forbidden");
    expect(statusCategory(409)).toBe("conflict");
  });
  it("emits correlated safe Pino JSON, including HTTP200 tool errors across releases", async () => {
    const { stdout, stderr } = await execute(
      process.execPath,
      ["--import", "tsx", "tests/fixtures/diagnostics.ts"],
      {
        env: {
          ...process.env,
          NODE_ENV: "production",
          GIT_SHA: "a".repeat(40),
        },
        maxBuffer: 256 * 1024,
      },
    );
    expect(stdout + stderr).not.toContain(
      "private-health-token-email@example.invalid",
    );
    const events = stdout
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line))
      .filter((line) => line.diagnostic_version === 1)
      .map(({ level: _level, time: _time, ...fields }) =>
        diagnosticEventSchema.parse(fields),
      );
    const conflict = events.find(
      (entry) =>
        entry.event === "mcp.complete" && entry.category === "conflict",
    );
    expect(conflict).toMatchObject({
      outcome: "error",
      tool: "log_meal",
      release: "a".repeat(40),
    });
    const success = events.find(
      (entry) =>
        entry.event === "request.complete" &&
        entry.request_id === conflict?.request_id,
    );
    expect(success).toMatchObject({
      status: 200,
      outcome: "ok",
      route_id: "/mcp",
    });
    const database = events.find(
      (entry) =>
        entry.event === "server.error" && entry.category === "dependency",
    );
    expect(
      events.find(
        (entry) =>
          entry.event === "request.complete" &&
          entry.request_id === database?.request_id,
      ),
    ).toMatchObject({ status: 503, route_id: "/workouts/:id" });
    expect(database?.request_id).not.toBe(conflict?.request_id);
    expect(events.find((entry) => entry.tool === "query")).toMatchObject({
      release: "b".repeat(40),
      category: "unexpected",
      outcome: "error",
    });
    expect(
      events.filter((entry) => entry.event === "mcp.complete"),
    ).toHaveLength(105);
    expect(
      events.find(
        (entry) =>
          entry.event === "server.error" && entry.category === "rate_limited",
      ),
    ).toBeDefined();
    expect(
      events.filter(
        (entry) => entry.event === "request.complete" && entry.status === 503,
      ),
    ).toHaveLength(2);
    expect(new Set(events.map((entry) => entry.event_id)).size).toBe(
      events.length,
    );
  });
});

it("keeps marked and ordinary Pino output valid under stdout backpressure", async () => {
  const child = spawn(
    process.execPath,
    ["--import", "tsx", "tests/fixtures/diagnostics-output.ts"],
    {
      env: { ...process.env, NODE_ENV: "production", GIT_SHA: "a".repeat(40) },
    },
  );
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stdout.pause();
  child.stdout.on("data", (chunk: string) => {
    stdout += chunk;
  });
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk: string) => {
    stderr += chunk;
  });
  const closed = new Promise<void>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`Output fixture exited ${code}`)),
    );
  });
  const resume = setTimeout(() => child.stdout.resume(), 1000);
  try {
    await closed;
  } finally {
    clearTimeout(resume);
    if (child.exitCode === null) child.kill();
  }
  expect(stderr).toBe("");
  expect(stdout).not.toContain("synthetic private canary");
  const lines = stdout
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  expect(lines).toHaveLength(10000);
  const marked = lines.filter((line) => line.diagnostic_version === 1);
  expect(marked).toHaveLength(5000);
  for (const { level: _level, time: _time, ...fields } of marked) {
    expect(diagnosticEventSchema.safeParse(fields).success).toBe(true);
  }
});
