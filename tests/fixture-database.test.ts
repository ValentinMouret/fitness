import { describe, expect, it } from "vitest";
import { canWriteFixtureDatabase } from "./e2e/support/fixture-database";

const local = "postgresql://localhost/fitness_test";
const ci = "postgresql://postgres/fitness";

describe("browser fixture write permission", () => {
  it.each([
    { name: "missing database", url: undefined, env: {}, allowed: false },
    {
      name: "mismatched database",
      url: local,
      env: { DATABASE_URL: ci, E2E_ALLOW_FIXTURE_WRITES: "true" },
      allowed: false,
    },
    {
      name: "CI isolated service",
      url: ci,
      env: { DATABASE_URL: ci, CI: "true" },
      allowed: true,
    },
    {
      name: "CI remote database",
      url: local,
      env: { DATABASE_URL: local, CI: "true" },
      allowed: false,
    },
    {
      name: "local default denies writes",
      url: local,
      env: { DATABASE_URL: local },
      allowed: false,
    },
    {
      name: "explicit local test database",
      url: local,
      env: { DATABASE_URL: local, E2E_ALLOW_FIXTURE_WRITES: "true" },
      allowed: true,
    },
    {
      name: "explicit loopback test server",
      url: local,
      env: {
        DATABASE_URL: local,
        E2E_ALLOW_FIXTURE_WRITES: "true",
        E2E_BASE_URL: "http://localhost:5173",
      },
      allowed: true,
    },
    {
      name: "non-test database name",
      url: "postgresql://localhost/fitness",
      env: {
        DATABASE_URL: "postgresql://localhost/fitness",
        E2E_ALLOW_FIXTURE_WRITES: "true",
      },
      allowed: false,
    },
    {
      name: "remote server",
      url: local,
      env: {
        DATABASE_URL: local,
        E2E_ALLOW_FIXTURE_WRITES: "true",
        E2E_BASE_URL: "https://fitness.example.com",
      },
      allowed: false,
    },
    {
      name: "remote database",
      url: "postgresql://db.example.com/fitness_test",
      env: {
        DATABASE_URL: "postgresql://db.example.com/fitness_test",
        E2E_ALLOW_FIXTURE_WRITES: "true",
      },
      allowed: false,
    },
    {
      name: "postgres host without CI",
      url: ci,
      env: { DATABASE_URL: ci, E2E_ALLOW_FIXTURE_WRITES: "true" },
      allowed: false,
    },
  ])("$name", ({ url, env, allowed }) => {
    expect(canWriteFixtureDatabase(url, env)).toBe(allowed);
  });
});
