import { Client } from "pg";
import { z } from "zod";

async function provisionRuntime() {
  const admin = new URL(z.url().parse(process.env.DATABASE_URL));
  const runtime = new URL(z.url().parse(process.env.APP_DATABASE_URL));
  if (
    runtime.username !== "fitness_app" ||
    !runtime.password ||
    admin.username === runtime.username ||
    runtime.hostname !== admin.hostname ||
    runtime.port !== admin.port ||
    runtime.pathname !== admin.pathname ||
    !["postgres:", "postgresql:"].includes(admin.protocol) ||
    !["postgres:", "postgresql:"].includes(runtime.protocol)
  )
    throw new Error("Invalid runtime database role configuration");

  const client = new Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(71204502)");
    const role = client.escapeIdentifier(runtime.username);
    const roleLiteral = client.escapeLiteral(runtime.username);
    const existing = await client.query(
      "select oid from pg_roles where rolname = $1",
      [runtime.username],
    );
    if (!existing.rowCount) await client.query(`create role ${role} nologin`);
    const unsafe = await client.query(
      `select 1 from pg_auth_members where member = ${roleLiteral}::regrole
       union all select 1 from pg_database where datdba = ${roleLiteral}::regrole
       union all select 1 from pg_namespace where nspowner = ${roleLiteral}::regrole
       union all select 1 from pg_class where relowner = ${roleLiteral}::regrole
       union all select 1 from pg_proc where proowner = ${roleLiteral}::regrole`,
    );
    if (unsafe.rowCount)
      throw new Error("Runtime role must not own objects or hold memberships");
    await client.query(
      `alter role ${role} login nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls password ${client.escapeLiteral(decodeURIComponent(runtime.password))}`,
    );
    await client.query(
      `alter role ${role} set search_path = public, pg_catalog`,
    );
    const database = client.escapeIdentifier(
      decodeURIComponent(runtime.pathname.slice(1)),
    );
    await client.query(
      `revoke create, temporary on database ${database} from public`,
    );
    await client.query(`revoke all on database ${database} from ${role}`);
    await client.query(`grant connect on database ${database} to ${role}`);
    await client.query("revoke create on schema public from public");
    await client.query(`revoke all on schema public from ${role}`);
    await client.query(`grant usage on schema public to ${role}`);
    await client.query(
      `revoke all on all tables in schema public from ${role}`,
    );
    await client.query(
      `grant select, insert, update, delete on all tables in schema public to ${role}`,
    );
    await client.query(
      `revoke all on all sequences in schema public from ${role}`,
    );
    await client.query(
      `grant usage, select on all sequences in schema public to ${role}`,
    );
    await client.query(
      `alter default privileges in schema public revoke all on tables from ${role}`,
    );
    await client.query(
      `alter default privileges in schema public grant select, insert, update, delete on tables to ${role}`,
    );
    await client.query(
      `alter default privileges in schema public revoke all on sequences from ${role}`,
    );
    await client.query(
      `alter default privileges in schema public grant usage, select on sequences to ${role}`,
    );
    await client.query("commit");
  } catch {
    await client.query("rollback");
    throw new Error("Runtime database role provisioning failed");
  } finally {
    await client.end();
  }
}

provisionRuntime().catch(() => {
  console.error("Runtime database role provisioning failed");
  process.exitCode = 1;
});
