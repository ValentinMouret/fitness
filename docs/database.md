# Database

## Model
- Things should first make sense to humans, not databases
- Names should be meaningful
- Usually, tables should have the columns:
  - `created_at timestamptz not null default now`
  - `updated_at timestamptz`
  - `deleted_at timestamptz`

## Database
- Don't use `varchar` unless it makes sense, please use `text` instead.

## Format
Queries should be formatted the following way:
- they should have a valid PostgreSQL syntax
- things should be snake-cased
- no uppercasing unless it makes sense
- align things column-wise

Example:
```sql
-- Don't do that:
CREATE TABLE FOO (
  name TEXT PRIMARY KEY,
  created_at TIMESTAMP NOT NULL DEFAULT NOW
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);

-- Do that instead:
create table foo (
  name       text        primary key,
  created_at timestamptz not null default now,
  updated_at timestamptz,
  deleted_at timestamptz
);
```

For `select` queries, please put the comma at the beginning of the rows, to make it easy to delete/comment:
```sql
select id
     , name
     , created_at
  from users
 where id = ?
```

The same goes for insert statements by the way:
```sql
insert into users
            (id
            , name
            , created_at)
     values ('some-id'
            , 'valentin'
            , now)
on conflict id
         do update
        set name = excluded.name
          , created_at = now
          , updated_at = now;
```

## Agent
If you need more context on the domain as to how it relates to the database, please ask questions before moving forward.
