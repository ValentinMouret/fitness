# Use Fitness through MCP

Fitness exposes 16 tools through its existing authenticated `/mcp` endpoint. Agents can read workouts, nutrition, and habits; manage workouts and meal logs; and create exercise and ingredient catalogue entries. The external agent chooses the conversation and recommendations; Fitness validates and saves the records.

Configure [OAuth](auth.md) first. This guide covers the tool contract and the separate database login required for SQL reads.

## Configure SQL reads

1. Run `bun run db:migrate`. Migration `0006_mcp_workout_views.sql` adds the `fitness_data` schema and six workout views; `0007_mcp_nutrition_views.sql` adds five nutrition views. It leaves the underlying tables unchanged.
2. Set `MCP_DATABASE_URL` in the server environment to a connection URL for `fitness_mcp_reader`, with a randomly generated password. It must point to the same database as `DATABASE_URL`. URL-encode the password when necessary. Never use the application login for this connection.
3. Run `bun run mcp:provision-reader` with a `DATABASE_URL` login that owns the views and can manage roles. This creates or updates the reader login and grants SELECT on only the exposed views. Production startup reruns provisioning after migrations when `MCP_DATABASE_URL` is set, so new views receive grants on deployment. It fails if role memberships, inherited schema/database creation rights, table/column privileges, or callable non-system functions would broaden access. Resolve the reported grants and rerun it; provisioning rolls back on failure.
4. Restart the existing app process to load the environment change, then connect a client and call `describe_schema` and `query`.

The provisioning command updates the reader password. Coordinate changes if several deployments use the same PostgreSQL cluster and reader role. PostgreSQL grants some privileges through `PUBLIC`; revoking a direct role grant does not remove those inherited privileges. Restrict unexpected PUBLIC grants deliberately, retaining any access the application needs.

The query executor additionally validates PostgreSQL syntax, permits one SELECT, restricts relations, functions, operators and casts, rechecks effective non-system function permissions on every query, and uses read-only transactions. It applies a three-second statement timeout, a 500-row limit, and a 256 KiB payload limit. The tool returns `{ rows, rowCount, truncated }`. When `truncated` is true, narrow the query or aggregate the results. SQL reads fail closed when `MCP_DATABASE_URL` is absent or uses an elevated login; write tools still work through the application connection.

## Discover and query data

Call `describe_schema` for columns, identifiers, units, enums, supported functions, and examples. The generic `query` tool operates over all exposed views. Adding other Fitness features later extends this schema without changing the query interface.

Workout views: `fitness_data.workouts`, `exercises`, `workout_exercises`, `sets`, `exercise_muscles`, and `muscle_volume`.

```sql
select id
     , name
     , type
  from fitness_data.exercises
 where name ilike '%press%'
 order by name;
```

Views exclude soft-deleted records and deleted parents. Timestamps are UTC instants; null `stop` means an ongoing workout. Set identity is `(workout_id, exercise_id, set_number)`. Weight is kilograms. Missing values remain null rather than being inferred as zero or bodyweight.

`reported_rir` is the lifter's approximate post-set answer:
`0`, `1`, `2`, `3`, `4+`, `unsure`, or null if unanswered. Historic `rpe` remains
separate and is never converted to RIR. A reported answer requires a completed
working set; corrections preserve the completion flag unless explicitly changed.

Completed, non-warm-up sets count as working sets, including those in ongoing workouts. Their volume is recorded reps × kilograms; missing performance contributes zero to this metric. `muscle_volume` attributes each working set using current catalogue muscle percentages: `weighted_sets = contribution_percent / 100`, and `volume_kg` is attributed by the same percentage. The app's muscle-volume history uses these same views. Date ranges use an inclusive start and exclusive end.

## Read and write nutrition

Nutrition views are `fitness_data.ingredients`, `meal_templates`,
`meal_template_ingredients`, `meal_logs`, and `meal_log_ingredients`. Use the
existing `query` and `describe_schema` tools to search ingredients, inspect
reusable templates, and read meal history. After deploying the migration, rerun
`bun run mcp:provision-reader` to grant access to the new views, then refresh the
client's tool discovery.

Ingredient calories are kcal per 100 g; protein, carbs, fat and fibre are grams
per 100 g. Meal quantities are grams. Multiply catalogue values by
`quantity_grams / 100` for meal nutrition. Values reflect the current catalogue,
as in the app; they are not historical snapshots. Template totals are stored
values. Deleted meals, templates, ingredients and composition rows are excluded
from their respective views. A deleted template does not hide a logged meal;
its exposed template reference becomes null.

| Tool | Contract |
| --- | --- |
| `create_ingredient` | Create an ingredient using catalogue nutrition and texture fields. Search first. Slider limits default to 5–500 grams. Duplicate names return `conflict`. |
| `log_meal` | Accept `loggedDate` (`YYYY-MM-DD`), `mealCategory`, optional `notes`, and nonempty `ingredients: [{ id, quantity }]`. IDs must exist; quantities are positive grams without duplicate IDs. An existing active meal on the same date/category returns `conflict`; nothing is appended or overwritten. |
| `update_meal_log` | Accept `mealId` and a complete ingredient composition, plus optional `notes` and `isCompleted`. Replace ingredients atomically; omitted ingredients are removed. Omitted notes/completion are preserved. An empty notes string clears notes. Date and category remain unchanged. |
| `delete_meal_log` | Soft-delete the meal and its composition. Repeating deletion succeeds. |

New meal logs start with `isCompleted: false`, matching the web app. This flag
is a checklist state: all logged meals count toward daily intake. Logging returns
the saved meal and its ingredients; updating returns meal metadata. Query the
composition after an update if needed. On an uncertain create response, query
before retrying; explicit composition updates can be repeated without adding
quantities. Template editing and target changes are not exposed yet.

## Read habits

Habit views are `fitness_data.habits` and `habit_completions`. The first lists
active, non-deleted habit definitions with identity phrase, minimum version,
schedule configuration, and start/end dates. The second lists dated completion
records for those habits, including explicit `completed = false` records and
notes. Missing dates have no completion record. A minimum action counts as a
completion; the stored record does not distinguish it from the full action.

Use `query` to inspect the active set or a bounded date range of history. The
reader receives SELECT on these two views after migration and production reader
provisioning. Habit completion writes are not exposed through MCP yet.

## Write workouts

| Tool | Contract |
| --- | --- |
| `create_exercise` | Create a catalogue exercise with name, type, movement pattern, optional descriptions, and unique integer muscle percentages totalling 100. Returns its ID and saved properties. |
| `create_workout` | Atomically create an empty, partial, or completed workout. Accept name, notes, start/stop ISO timestamps, and ordered exercises with sets. Start defaults to now. Future times and stop before start are rejected. |
| `delete_workout` | Soft-delete a workout and its exercise/set records. |
| `finish_workout` | Set stop to the supplied timestamp or now. Already finished workouts retain their stop time. Pending sets stay pending. |
| `add_exercise_to_workout` | Append an existing catalogue exercise ID, optionally with notes and sets. Does not create implicit sets. An exercise already present is a conflict. |
| `remove_exercise_from_workout` | Remove the exercise and all its sets from this workout; retain the catalogue entry. |
| `replace_exercise_in_workout` | Replace pending work while preserving completed performance; see below. |
| `save_workout_sets` | Create or replace the explicitly numbered sets for a workout exercise. Other sets remain unchanged. |
| `delete_workout_sets` | Delete the specified set numbers. All must exist; otherwise none are deleted. |

Search the catalogue with `query` first. Reuse a matching ID, or call `create_exercise`, then pass its ID to `create_workout` or `add_exercise_to_workout`.

Each supplied set is a complete desired record. It has `set`, optional `targetReps`, `reps`, `weight`, `note`, and `rpe`, plus `isCompleted`, `isWarmup`, and `isFailure`. Omitted optional fields clear to null; omitted flags become false. Use the same set numbers to correct or retry a save. Setting a workout's stop timestamp does not infer completion for its sets.

Replacement keeps completed sets under the original exercise. Pending sets move to the new exercise, retaining targets, warm-up flags, and notes while clearing reps, weight, RPE, and failure. If completed sets remain, the replacement is inserted immediately after the original; otherwise it takes the original position. Its sets are numbered from one in their original order. Replacement with an exercise already in the workout is rejected. If all original sets are completed, add the new exercise instead.

Writes return saved records with identifiers or a structured error with `invalid_input`, `not_found`, `conflict`, or `database_error`. MCP marks tool failures with `isError`. Workout mutations lock the session and persist atomically. Creation generates a new ID on each call; after an uncertain response, query before retrying creation.

MCP handlers and browser form adapters parse inputs before calling the shared,
typed application operations. The existing workout repository implements their
persistence interface and owns transactions and locking.

Separate editing tools for names, notes, timestamps, exercise notes, and order are deferred. Supply these at creation. Plans and reusable templates are also deferred.

## Verify changes

Run `bun run gate` and `bun run test:mcp:integration`. The integration suite requires a running local PostgreSQL administrator connection, defaulting to `postgresql://localhost/postgres`; override it with `MCP_TEST_ADMIN_URL`. It creates and removes a uniquely named database and reader role, and never starts a database or app server.

The suite covers historical and progressive recording, replacement, repeatable and concurrent saves, rollback after injected persistence failure, database permissions, SQL syntax restrictions, and row/byte/time limits. Test changed browser workflows against the existing server with Playwright.

Actual ChatGPT/Claude linking and Secure-cookie verification require a public HTTPS deployment and configured client credentials. Local fixture tests do not verify those external connections.
