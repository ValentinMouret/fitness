# Database conventions

Use this guide before modelling data or changing persistence. Fitness uses
PostgreSQL and Drizzle. The [schema](../../app/db/schema.ts) and committed
[migrations](../../drizzle/) define the implemented database structure; feature
pages explain its product meaning rather than duplicating SQL definitions.

## Model the domain first

- Model concepts for people before tables. Use meaningful names.
- Fitness is solo-ware: do not add `user_id` ownership to every table.
- Preserve queryable history and a clear latest value.
- Account for incomplete historical data, imports, and backfill.
- Support linked records where the domain requires them, such as a habit log
  creating a measurement.
- Keep automation narrow until the base model is reliable.

Ask about ambiguous domain rules before committing them to a schema. Tables
usually need `created_at`, `updated_at`, and `deleted_at` timestamps; decide their
meaning for the entity rather than adding them mechanically. Prefer `text` over
`varchar` unless a length restriction has a domain reason.

## Change and migrate the schema

During local development, use `bun run db:dev` to push an evolving schema. Only
use it against a development database. Once the schema is final, generate and
review a migration with `bun run db:generate`; apply committed migrations with
`bun run db:migrate`.

Commit the generated SQL and Drizzle metadata together. Use `bun run db:check`
and `bun run db:check-drift` to check migration consistency and schema drift.
Do not add `if not exists` clauses merely to hide unexpected schema differences;
migrations are tracked by the migration runner.

See the [project README](../../README.md) for the command overview and
[deployment guide](../../deploy/README.md) for production procedures. Tests that
write to a database need an explicitly selected test database; see
[testing](testing.md).

## Write readable SQL

Use valid PostgreSQL syntax, snake_case identifiers, lowercase keywords, and
column alignment. Put commas at the start of continuation lines in select lists
and insert column/value lists.

```sql
create table example_records (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  deleted_at timestamptz
);

select id
     , name
     , created_at
  from example_records
 where id = $1;

insert into example_records
            (id
           , name)
     values ($1
           , $2)
on conflict (id)
  do update
        set name = excluded.name
          , updated_at = now();
```
