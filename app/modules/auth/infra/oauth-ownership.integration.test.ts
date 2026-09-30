import { randomUUID } from "node:crypto";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { createDisposablePostgres } from "../../../../tests/integration/support/disposable-postgres";
import { bootstrapAuthOwner } from "./owner-bootstrap.server";

const fixture = createDisposablePostgres(
  new URL(z.url().parse(process.env.AUTH_TEST_ADMIN_URL)),
);
const { database, pool } = fixture;
const ownerId = randomUUID();
const otherId = randomUUID();
const connectionIds = [randomUUID(), randomUUID()];
const tables = [
  "oauth_connections",
  "oauth_authorization_codes",
  "oauth_tokens",
];
let original: readonly (readonly Record<string, unknown>[])[] = [];
async function records() {
  return Promise.all(
    tables.map(
      async (table) =>
        (await pool.query(`select * from ${table} order by 1`)).rows,
    ),
  );
}
beforeAll(async () => {
  await fixture.create();
  await fixture.migrateBefore(15);
  for (const [index, id] of connectionIds.entries()) {
    await pool.query(
      "insert into oauth_connections (id,client_id,resource,scope,revoked_at) values ($1,'fixture','http://localhost/mcp','fitness',$2)",
      [id, index ? new Date("2000-01-01") : null],
    );
    await pool.query(
      "insert into oauth_authorization_codes (hash,connection_id,redirect_uri,challenge,expires_at,consumed_at) values ($1,$2,'https://example.invalid/callback','fixture','2099-01-01',$3)",
      [`fixture-code-${index}`, id, index ? new Date("2000-01-01") : null],
    );
    await pool.query(
      "insert into oauth_tokens (access_hash,refresh_hash,connection_id,access_expires_at,refresh_expires_at,rotated_at) values ($1,$2,$3,'2099-01-01','2099-01-02',$4)",
      [
        `fixture-access-${index}`,
        `fixture-refresh-${index}`,
        id,
        index ? new Date("2000-01-01") : null,
      ],
    );
  }
  original = await records();
});
afterAll(() => fixture.close());
describe.sequential("OAuth legacy connection ownership", () => {
  it("rolls back without an explicitly accepted bootstrap owner", async () => {
    await expect(
      migrate(database, { migrationsFolder: "./drizzle" }),
    ).rejects.toThrow();
    expect(await records()).toEqual(original);
  });
  it("rejects ambiguous owners without changing credentials or connections", async () => {
    for (const id of [ownerId, otherId])
      expect(
        (
          await bootstrapAuthOwner({
            pool,
            id,
            email: `${id}@example.invalid`,
            now: new Date(),
          })
        ).isOk(),
      ).toBe(true);
    await expect(
      migrate(database, { migrationsFolder: "./drizzle" }),
    ).rejects.toThrow();
    expect(await records()).toEqual(original);
    await pool.query("delete from auth_users where id=$1", [otherId]);
  });
  it("assigns active and revoked connections while preserving credentials and history exactly", async () => {
    await migrate(database, { migrationsFolder: "./drizzle" });
    const migrated = await records();
    expect(migrated[0].map(({ user_id, ...row }) => row)).toEqual(original[0]);
    expect(migrated[0].every((row) => row.user_id === ownerId)).toBe(true);
    expect(migrated.slice(1)).toEqual(original.slice(1));
    await expect(
      pool.query(
        "insert into oauth_connections (client_id,resource,scope) values ('fixture','http://localhost/mcp','fitness')",
      ),
    ).rejects.toThrow();
    await expect(
      pool.query(
        "insert into oauth_connections (user_id,client_id,resource,scope) values ($1,'fixture','http://localhost/mcp','fitness')",
        [otherId],
      ),
    ).rejects.toThrow();
  });
});
