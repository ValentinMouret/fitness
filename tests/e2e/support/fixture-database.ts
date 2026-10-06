import { randomUUID } from "node:crypto";
import type { APIRequestContext } from "@playwright/test";
import type pg from "pg";
import { userIdSchema } from "../../../app/modules/auth/domain/user";

const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function canWriteFixtureDatabase(
  databaseUrl: string | undefined,
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  if (!databaseUrl || databaseUrl !== env.DATABASE_URL) return false;
  const database = new URL(databaseUrl);
  const databaseHost = database.hostname;
  if (env.CI === "true") return databaseHost === "postgres";
  return (
    env.E2E_ALLOW_FIXTURE_WRITES === "true" &&
    loopbackHosts.has(databaseHost) &&
    /(?:^|[_-])test(?:[_-]|$)/i.test(database.pathname.slice(1)) &&
    loopbackHosts.has(
      new URL(env.E2E_BASE_URL ?? "http://127.0.0.1:5175").hostname,
    )
  );
}

export const fixtureOwnerId = () =>
  userIdSchema.parse(process.env.AUTH_FOUNDATION_OWNER_USER_ID);

export async function verifyFixtureServerDatabase(
  request: APIRequestContext,
  pool: pg.Pool,
): Promise<void> {
  const id = randomUUID();
  const name = `fixture-database-${id}`;
  try {
    await pool.query(
      `insert into workouts (user_id,id, name, start, stop)
       values ($3,$1, $2, '1900-01-01 10:00:00', '1900-01-01 10:30:00')`,
      [id, name, fixtureOwnerId()],
    );
    const response = await request.get(`/workouts/${id}`);
    if (!response.ok() || !(await response.text()).includes(name)) {
      throw new Error(
        "The existing Fitness server cannot read the fixture database marker. Check its DATABASE_URL before allowing browser fixture writes.",
      );
    }
  } finally {
    await pool.query("delete from workouts where id = $1", [id]);
  }
}
