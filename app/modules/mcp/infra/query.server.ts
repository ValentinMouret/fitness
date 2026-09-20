import { ResultAsync } from "neverthrow";
import { Pool, type PoolClient } from "pg";
import { deparse, parse } from "pgsql-parser";
import { z } from "zod";
import { env } from "~/env.server";
import { logger } from "~/logger.server";
import { queryLimits, validateQueryAst } from "../domain/query-policy";

let pool: Pool | undefined;
export const queryInputSchema = z
  .object({ sql: z.string().min(1).max(queryLimits.sqlBytes) })
  .strict();
export type QueryResult = {
  readonly rows: readonly Record<string, unknown>[];
  readonly rowCount: number;
  readonly truncated: boolean;
};
const rowSchema = z.object({ payload: z.string().nullable() });

export function createQueryRunner(
  connect: () => Promise<PoolClient>,
  expectedRole = "fitness_mcp_reader",
) {
  return ({
    sql,
  }: Readonly<z.infer<typeof queryInputSchema>>): ResultAsync<
    QueryResult,
    string
  > =>
    ResultAsync.fromPromise(
      (async () => {
        if (Buffer.byteLength(sql) > queryLimits.sqlBytes)
          throw new Error("SQL exceeds the byte limit");
        const ast = await parse(sql);
        const validation = validateQueryAst(ast);
        if (validation.isErr()) throw new Error(validation.error);
        const normalized = (await deparse(ast)).replace(/;\s*$/, "");
        const client = await connect();
        let broken = false;
        try {
          await client.query("begin read only");
          await client.query(
            `set local statement_timeout = '${queryLimits.timeoutMs}ms'`,
          );
          await client.query("set local lock_timeout = '500ms'");
          await client.query(
            "set local search_path = pg_catalog, fitness_data",
          );
          await client.query("set local timezone = 'UTC'");
          await client.query("set local work_mem = '4MB'");
          const identity = await client.query<{ safe: boolean }>(
            `select session_user = current_user and current_user = $1 and not rolsuper and not rolcreaterole and not rolcreatedb and not rolbypassrls and not rolreplication and not exists (select 1 from pg_auth_members where member = r.oid) as safe from pg_roles r where rolname = current_user`,
            [expectedRole],
          );
          if (!identity.rows[0]?.safe)
            throw new Error(
              "The query connection must use the restricted fitness_mcp_reader role",
            );
          const functions = await client.query<{
            safe: boolean;
          }>(`select not exists (
            select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname not in ('pg_catalog', 'information_schema')
               and has_schema_privilege(current_user, n.oid, 'USAGE')
               and has_function_privilege(current_user, p.oid, 'EXECUTE')
          ) as safe`);
          if (!functions.rows[0]?.safe)
            throw new Error(
              "Reader can execute non-system functions. Restrict function grants before querying",
            );
          const result = await client.query({
            text: `with mcp_rows as materialized (
          select row_to_json(r)::text as payload from (${normalized}) r limit ${queryLimits.rows + 1}
        ), mcp_sized as (
          select payload, row_number() over () as n, sum(octet_length(payload)) over (rows unbounded preceding) as bytes from mcp_rows
        ) select case when n <= ${queryLimits.rows} and bytes <= ${queryLimits.bytes} then payload else null end as payload from mcp_sized`,
          });
          const rows: Record<string, unknown>[] = [];
          let truncated = false;
          for (const raw of result.rows) {
            const { payload } = rowSchema.parse(raw);
            if (payload === null) {
              truncated = true;
              continue;
            }
            rows.push(
              z.record(z.string(), z.unknown()).parse(JSON.parse(payload)),
            );
          }
          await client.query("rollback");
          return { rows, rowCount: rows.length, truncated };
        } catch (error) {
          broken = true;
          throw error;
        } finally {
          client.release(broken);
        }
      })(),
      (error) => {
        logger.warn({ err: error }, "MCP query rejected or failed");
        if (error instanceof Error && !("code" in error)) return error.message;
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "57014"
        )
          return "Query exceeded the time limit; narrow the date range or simplify it";
        return "Query failed. Check describe_schema, column names, types, and SQL permissions";
      },
    );
}

export const runQuery = createQueryRunner(async () => {
  if (!env.MCP_DATABASE_URL) throw new Error("SQL reads are not configured");
  pool ??= new Pool({
    connectionString: env.MCP_DATABASE_URL,
    max: 2,
    connectionTimeoutMillis: 2000,
    idleTimeoutMillis: 10000,
    query_timeout: queryLimits.timeoutMs + 1000,
  }).on("error", (error) =>
    logger.error({ err: error }, "MCP reader connection failed"),
  );
  return pool.connect();
});
