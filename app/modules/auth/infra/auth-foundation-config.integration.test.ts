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
    const invalid: ReadonlyArray<Readonly<Record<string, string>>> = [
      { AUTH_FOUNDATION_ORIGIN: "https://fitness.example.invalid" },
      { AUTH_FOUNDATION_OWNER_USER_ID: "" },
      { AUTH_LOCAL_INBOX: "" },
    ];
    for (const overrides of invalid) {
      expect(validate({ ...local, ...overrides }).status).not.toBe(0);
    }
  });
});

const production = {
  AUTH_FOUNDATION_ENABLED: "true",
  NODE_ENV: "production",
  AUTH_FOUNDATION_ORIGIN: "https://fitness.example.invalid",
  AUTH_FOUNDATION_OWNER_USER_ID: local.AUTH_FOUNDATION_OWNER_USER_ID,
  AUTH_SMTP_HOST: "smtp.example.invalid",
  AUTH_SMTP_PORT: "587",
  AUTH_SMTP_SECURE: "false",
  AUTH_SMTP_USER: "fixture-user",
  AUTH_SMTP_PASSWORD: "fixture-password",
  AUTH_SMTP_FROM: "fitness@example.invalid",
};

describe("production authentication configuration", () => {
  it("accepts complete STARTTLS and implicit TLS settings", () => {
    expect(validate(production).status).toBe(0);
    expect(
      validate({
        ...production,
        AUTH_SMTP_PORT: "465",
        AUTH_SMTP_SECURE: "true",
      }).status,
    ).toBe(0);
  });

  it("rejects incomplete settings without printing secrets", () => {
    for (const key of [
      "AUTH_FOUNDATION_ORIGIN",
      "AUTH_FOUNDATION_OWNER_USER_ID",
      "AUTH_SMTP_HOST",
      "AUTH_SMTP_PORT",
      "AUTH_SMTP_SECURE",
      "AUTH_SMTP_USER",
      "AUTH_SMTP_PASSWORD",
      "AUTH_SMTP_FROM",
    ]) {
      const result = validate({ ...production, [key]: "" });
      expect(result.status).not.toBe(0);
      expect(result.stderr).not.toContain(production.AUTH_SMTP_PASSWORD);
    }
  });

  it("rejects insecure or ambiguous origins, mixed inbox and invalid SMTP settings", () => {
    const invalid: ReadonlyArray<Readonly<Record<string, string>>> = [
      { AUTH_FOUNDATION_ORIGIN: "http://fitness.example.invalid" },
      { AUTH_FOUNDATION_ORIGIN: "https://fitness.example.invalid/" },
      { AUTH_FOUNDATION_ORIGIN: "https://fitness.example.invalid/path" },
      {
        AUTH_FOUNDATION_ORIGIN: "https://fitness.example.invalid?token=fixture",
      },
      {
        AUTH_FOUNDATION_ORIGIN: "https://user:password@fitness.example.invalid",
      },
      { AUTH_LOCAL_INBOX: local.AUTH_LOCAL_INBOX },
      { AUTH_SMTP_PORT: "0" },
      { AUTH_SMTP_PORT: "65536" },
      { AUTH_SMTP_SECURE: "yes" },
      { AUTH_SMTP_HOST: "smtp://example.invalid" },
      { AUTH_SMTP_FROM: "Fitness <fitness@example.invalid>" },
      {
        AUTH_SMTP_FROM: "fitness@example.invalid\r\nBcc: other@example.invalid",
      },
    ];
    for (const overrides of invalid)
      expect(validate({ ...production, ...overrides }).status).not.toBe(0);
    expect(
      validate({ ...local, AUTH_SMTP_HOST: production.AUTH_SMTP_HOST }).status,
    ).not.toBe(0);
  });
});
