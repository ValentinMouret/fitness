import { Client } from "pg";
import { exposedViews } from "../domain/query-policy";

/** Provision the dedicated query login after applying the view migration. */
export async function provisionReader(
  adminUrl: string,
  readerUrl: string,
  expectedRole = "fitness_mcp_reader",
) {
  const admin = new URL(adminUrl);
  const reader = new URL(readerUrl);
  if (
    reader.username !== expectedRole ||
    !reader.password ||
    reader.hostname !== admin.hostname ||
    reader.port !== admin.port ||
    reader.pathname !== admin.pathname
  )
    throw new Error(
      "MCP_DATABASE_URL must use fitness_mcp_reader, a password, and the same database host/port/name as DATABASE_URL",
    );
  const client = new Client({ connectionString: adminUrl });
  const role = client.escapeIdentifier(reader.username);
  const roleLiteral = client.escapeLiteral(reader.username);
  await client.connect();
  try {
    await client.query(`begin`);
    const existing = await client.query(
      `select 1 from pg_roles where rolname = ${roleLiteral}`,
    );
    if (!existing.rowCount)
      await client.query(
        `create role ${role} nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls`,
      );
    const membership = await client.query(
      `select 1 from pg_auth_members m join pg_roles r on r.oid = m.member where r.rolname = ${roleLiteral}`,
    );
    if (membership.rowCount)
      throw new Error("fitness_mcp_reader must have no role memberships");
    await client.query(
      `alter role ${role} login nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls password ${client.escapeLiteral(decodeURIComponent(reader.password))}`,
    );
    await client.query(
      `alter role ${role} set default_transaction_read_only = on`,
    );
    await client.query(`alter role ${role} set statement_timeout = '3s'`);
    await client.query(
      `alter role ${role} set search_path = pg_catalog, fitness_data`,
    );
    await client.query(
      `grant connect on database ${client.escapeIdentifier(decodeURIComponent(reader.pathname.slice(1)))} to ${role}`,
    );
    await client.query(
      `revoke all on all tables in schema public from ${role}`,
    );
    await client.query(
      `revoke all on all functions in schema public from ${role}`,
    );
    await client.query(`revoke all on schema public from ${role}`);
    await client.query(`revoke all on schema fitness_data from ${role}`);
    await client.query(
      `revoke all on all tables in schema fitness_data from ${role}`,
    );
    await client.query(`grant usage on schema fitness_data to ${role}`);
    for (const view of exposedViews)
      await client.query(`grant select on fitness_data.${view} to ${role}`);
    const writableDatabase = await client.query(
      `select has_database_privilege(${roleLiteral}, current_database(), 'CREATE') as allowed`,
    );
    if (writableDatabase.rows[0]?.allowed)
      throw new Error(
        "Reader inherits database CREATE privileges. Revoke those grants before provisioning",
      );
    const writableSchemas = await client.query(`select nspname from pg_namespace
      where nspname not in ('pg_catalog', 'information_schema') and nspname not like 'pg_%'
        and has_schema_privilege(${roleLiteral}, oid, 'CREATE')`);
    if (writableSchemas.rowCount)
      throw new Error(
        "Reader inherits schema CREATE privileges, possibly through PUBLIC. Revoke those grants before provisioning",
      );
    const tables =
      await client.query(`select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname not in ('pg_catalog', 'information_schema') and n.nspname not like 'pg_toast%'
        and c.relkind in ('r','v','m','f','p') and (has_table_privilege(${roleLiteral}, c.oid, 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
        or ((n.nspname <> 'fitness_data' or c.relname not in (${exposedViews.map((name) => client.escapeLiteral(name)).join(",")})) and (has_table_privilege(${roleLiteral}, c.oid, 'SELECT') or has_any_column_privilege(${roleLiteral}, c.oid, 'SELECT'))) or has_any_column_privilege(${roleLiteral}, c.oid, 'INSERT,UPDATE,REFERENCES'))`);
    if (tables.rowCount)
      throw new Error(
        "Reader inherits table privileges, possibly through PUBLIC. Revoke unintended grants before provisioning",
      );
    const functions =
      await client.query(`select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname not in ('pg_catalog', 'information_schema') and has_schema_privilege(${roleLiteral}, n.oid, 'USAGE') and has_function_privilege(${roleLiteral}, p.oid, 'EXECUTE')`);
    if (functions.rowCount)
      throw new Error(
        "Reader can execute non-system functions, possibly through PUBLIC. Restrict those function grants before provisioning",
      );
    await client.query(`commit`);
  } finally {
    await client.end();
  }
}
