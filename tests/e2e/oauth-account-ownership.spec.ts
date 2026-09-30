import { createHash, randomBytes, randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import pg from "pg";
import { z } from "zod";
import {
  canWriteFixtureDatabase,
  verifyFixtureServerDatabase,
} from "./support/fixture-database";
import {
  clients,
  expectMcpAccess,
  expectMcpDenied,
  mcpResource,
} from "./support/oauth";

test.skip(
  !canWriteFixtureDatabase(process.env.E2E_DATABASE_URL),
  "Requires a matching dedicated fixture database and server",
);
test("valid credentials belonging to another account cannot reach global MCP tools", async ({
  request,
}) => {
  const pool = new pg.Pool({ connectionString: process.env.E2E_DATABASE_URL });
  const ownerId = z.uuid().parse(process.env.AUTH_FOUNDATION_OWNER_USER_ID);
  const otherId = randomUUID();
  const connections: string[] = [];
  const hash = (raw: string) => createHash("sha256").update(raw).digest("hex");
  try {
    await verifyFixtureServerDatabase(request, pool);
    await pool.query(
      "insert into auth_users (id,name,email) values ($1,'OAuth fixture',$2)",
      [otherId, `${otherId}@example.invalid`],
    );
    await pool.query(
      "insert into auth_invitations (user_id,invited_by,expires_at,accepted_at) values ($1,$2,now(),now())",
      [otherId, ownerId],
    );
    const credentials = [];
    for (const userId of [ownerId, otherId]) {
      const id = randomUUID();
      connections.push(id);
      const access = randomBytes(32).toString("base64url");
      const refresh = randomBytes(32).toString("base64url");
      await pool.query(
        "insert into oauth_connections (id,user_id,client_id,resource,scope) values ($1,$2,$3,$4,'fitness')",
        [id, userId, clients[0].id, mcpResource],
      );
      await pool.query(
        "insert into oauth_tokens (connection_id,access_hash,refresh_hash,access_expires_at,refresh_expires_at) values ($1,$2,$3,now()+interval '1 hour',now()+interval '2 hour')",
        [id, hash(access), hash(refresh)],
      );
      credentials.push(access);
    }
    await expectMcpAccess(request, credentials[0]);
    await expectMcpDenied(request, credentials[1]);
    await pool.query(
      "update auth_invitations set revoked_at=now() where user_id=$1",
      [otherId],
    );
    await expectMcpDenied(request, credentials[1]);
    await expectMcpAccess(request, credentials[0]);
    expect(
      (
        await pool.query("select user_id from oauth_connections where id=$1", [
          connections[1],
        ])
      ).rows,
    ).toEqual([{ user_id: otherId }]);
  } finally {
    await pool.query(
      "delete from oauth_tokens where connection_id=any($1::uuid[])",
      [connections],
    );
    await pool.query("delete from oauth_connections where id=any($1::uuid[])", [
      connections,
    ]);
    await pool.query("delete from auth_users where id=$1", [otherId]);
    await pool.end();
  }
});
