import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

function validate(overrides: Readonly<Record<string, string>>) {
  return spawnSync(
    "bun",
    [
      "-e",
      'const { env } = await import("./app/env.server.ts"); console.log(env.AUTH_FOUNDATION_ENABLED);',
    ],
    {
      encoding: "utf8",
      env: {
        PATH: process.env.PATH,
        NODE_ENV: "test",
        DATABASE_URL: "postgresql://localhost/fitness_auth_test",
        ANTHROPIC_API_KEY: "fixture",
        AUTH_USERNAME: "fixture",
        AUTH_PASSWORD: "fixture",
        AUTH_SESSION_SECRET: "fixture-only-secret-at-least-32-characters",
        OAUTH_CLIENTS: "[]",
        AUTH_FOUNDATION_ENABLED: "false",
        ...overrides,
      },
    },
  );
}

const local = {
  AUTH_FOUNDATION_ENABLED: "true",
  AUTH_FOUNDATION_ORIGIN: "http://127.0.0.1:5196",
  AUTH_FOUNDATION_OWNER_USER_ID: "720cbf7c-67b5-4d6b-b026-c8e1099ff435",
  AUTH_LOCAL_INBOX: "/tmp/fitness-fixture-inbox.jsonl",
};

describe("local authentication foundation configuration", () => {
  it("keeps production admission disabled by default", () => {
    const result = validate({ NODE_ENV: "production" });
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe("false");
  });

  it("accepts complete loopback configuration only outside production", () => {
    expect(validate(local).status).toBe(0);
    expect(validate({ ...local, NODE_ENV: "production" }).status).not.toBe(0);
  });

  it("rejects nonlocal origins and incomplete owner or inbox configuration", () => {
    for (const overrides of [
      { AUTH_FOUNDATION_ORIGIN: "https://fitness.example.invalid" },
      { AUTH_FOUNDATION_OWNER_USER_ID: "" },
      { AUTH_LOCAL_INBOX: "" },
    ]) {
      expect(validate({ ...local, ...overrides }).status).not.toBe(0);
    }
  });
});
