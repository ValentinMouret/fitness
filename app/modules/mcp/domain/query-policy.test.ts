import { parse } from "pgsql-parser";
import { describe, expect, it } from "vitest";
import { validateQueryAst } from "./query-policy";

describe("SQL access policy", () => {
  it.each([
    "select * from fitness_data.sets",
    "with x as (select * from workouts), y as (select * from x) select * from y",
    "with x as (select * from workouts) select * from (select * from x) nested",
    "with recursive x(n) as (select 1 union all select n + 1 from x where n < 3) select * from x",
    "with recursive x as (select * from y), y as (select * from workouts) select * from x",

    "select count(*), avg(weight_kg) from sets where reps between 8 and 12",
    "select * from workouts where name ilike '%leg%' and stop is not null",
    "with x as (select * from sets) select * from x union all select * from x",
    "select date_trunc('week', start), sum(weighted_sets) from muscle_volume group by 1",
    "select case when is_completed then coalesce(reps, 0) else 0 end from sets",
  ])("allows %s", async (sql) => {
    expect(validateQueryAst(await parse(sql))).toMatchObject({
      value: undefined,
    });
  });
  it.each([
    "select * from public.oauth_tokens",
    "select * from pg_roles where exists (with pg_roles as (select * from workouts) select 1)",
    "with a as (with pg_roles as (select 1) select 1) select * from pg_roles",
    "with pg_roles as (select * from pg_roles) select * from pg_roles",
    "with x as (select * from pg_roles), pg_roles as (select * from workouts) select * from x",
    "with recursive x as (with pg_roles as (select 1) select 1) select * from pg_roles",

    "select * from pg_catalog.pg_roles",
    "select * from oauth_tokens",
    "select 1; delete from workouts",
    "delete from workouts",
    "select * into copied from workouts",
    "select * from workouts for update",
    "with x as (delete from workouts returning *) select * from x",
    "select pg_sleep(10)",
    "select set_config('statement_timeout', '0', false)",
    "select pg_read_file('/etc/passwd')",
    "select public.lower('x')",
    "select lo_export(1, '/tmp/x')",
    "select query_to_xml('select * from public.oauth_tokens', true, false, '')",
    "select 'oauth_tokens'::regclass",
    "select 'x'::public.secret",
    "select 1 operator(public.+) 2",
    "select * from workouts tablesample system(10)",
    "copy (select * from workouts) to stdout",
  ])("rejects %s", async (sql) => {
    expect(validateQueryAst(await parse(sql)).isErr()).toBe(true);
  });
});
