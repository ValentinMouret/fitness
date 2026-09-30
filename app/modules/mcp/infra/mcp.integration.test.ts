import { randomUUID } from "node:crypto";
import { Client as McpClient } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client, Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { userIdSchema } from "~/modules/auth/domain/user";
import { workoutOperations } from "~/modules/fitness/application/workout-operations";
import {
  createWorkoutSchema,
  patchSetSchema,
  saveSetsSchema,
} from "~/modules/fitness/domain/workout-commands";
import { createWorkoutRepository } from "~/modules/fitness/infra/workout.repository.server";
import { nutritionOperations } from "~/modules/nutrition/application/nutrition-operations";
import { logMealSchema } from "~/modules/nutrition/domain/nutrition-commands";
import { createIngredientRepository } from "~/modules/nutrition/infra/ingredient.repository.server";
import { createMealLogRepository } from "~/modules/nutrition/infra/meal-log.repository.server";
import { provisionReader } from "./provision-reader.server";
import { createQueryRunner } from "./query.server";
import { schemaDescription } from "./schema-description";
import { registerFitnessTools } from "./tools.server";

const settings = z
  .object({
    MCP_TEST_ADMIN_URL: z.string().default("postgresql://localhost/postgres"),
  })
  .parse(process.env);
const adminUrl = new URL(settings.MCP_TEST_ADMIN_URL);
if (!["localhost", "127.0.0.1", "[::1]"].includes(adminUrl.hostname))
  throw new Error(
    "MCP integration tests require a local disposable PostgreSQL database",
  );
const databaseName = `fitness_mcp_test_${randomUUID().replaceAll("-", "")}`;
const databaseUrl = new URL(adminUrl);
databaseUrl.pathname = `/${databaseName}`;
const readerRole = `mcp_test_${randomUUID().replaceAll("-", "")}`;
const readerUrl = new URL(databaseUrl);
readerUrl.username = readerRole;
readerUrl.password = randomUUID();
const admin = new Client({ connectionString: adminUrl.toString() });
const writer = new Pool({ connectionString: databaseUrl.toString() });
const reader = new Pool({
  connectionString: readerUrl.toString(),
  max: 2,
  query_timeout: 4000,
});
const database = drizzle(writer);
const ownerUserId = userIdSchema.parse(randomUUID());
const repository = createWorkoutRepository(ownerUserId, database);
const operations = workoutOperations(repository);
const nutrition = nutritionOperations(
  createIngredientRepository(database),
  createMealLogRepository(database),
);
const query = createQueryRunner(
  ownerUserId,
  () => reader.connect(),
  readerRole,
);
let createdDatabase = false;
let createdRole = false;

beforeAll(async () => {
  await admin.connect();
  await admin.query(`create database ${admin.escapeIdentifier(databaseName)}`);
  createdDatabase = true;
  await migrate(database, { migrationsFolder: "./drizzle" });
  await writer.query(
    "insert into auth_users (id, name, email) values ($1, 'MCP test owner', 'owner@example.invalid')",
    [ownerUserId],
  );
  await writer.query("revoke create on schema public from public");
  await provisionReader(
    databaseUrl.toString(),
    readerUrl.toString(),
    readerRole,
  );
  createdRole = true;
});

afterAll(async () => {
  await reader.end();
  await writer.end();
  if (createdDatabase)
    await admin.query(`drop database ${admin.escapeIdentifier(databaseName)}`);
  if (createdRole)
    await admin.query(`drop role ${admin.escapeIdentifier(readerRole)}`);
  await admin.end();
});

const exercise = async (name: string) =>
  (
    await operations.createExercise({
      name: `${name} ${randomUUID()}`,
      type: "dumbbells",
      movementPattern: "push",
      muscleGroupSplits: [
        { muscleGroup: "pecs", split: 80 },
        { muscleGroup: "triceps", split: 20 },
      ],
    })
  )._unsafeUnwrap().exercise;

describe("workout operations and restricted SQL", () => {
  it("stores post-set reports distinctly from legacy RPE in the restricted view", async () => {
    const entry = await exercise("Effort");
    const created = (
      await operations.createWorkout(
        createWorkoutSchema.parse({
          name: "Effort flow",
          exercises: [
            {
              exerciseId: entry.id,
              sets: [
                {
                  set: 1,
                  targetReps: 8,
                  rpe: 8,
                },
              ],
            },
          ],
        }),
      )
    )._unsafeUnwrap();
    const workoutId = created.workout.id;
    const before = (
      await query({
        sql: `select reported_rir, rpe from fitness_data.sets where workout_id = '${workoutId}'`,
      })
    )._unsafeUnwrap().rows;
    expect(before).toEqual([
      {
        reported_rir: null,
        rpe: 8,
      },
    ]);
    await operations.updateSet(
      patchSetSchema.parse({
        workoutId,
        exerciseId: entry.id,
        set: 1,
        updates: { reps: 8, weight: 80, isCompleted: true, reportedRir: "4+" },
      }),
    );
    expect(
      (
        await query({
          sql: `select is_completed, reported_rir, rpe from fitness_data.sets where workout_id = '${workoutId}'`,
        })
      )._unsafeUnwrap().rows,
    ).toEqual([
      {
        is_completed: true,
        reported_rir: "4+",
        rpe: 8,
      },
    ]);
    expect(
      (
        await operations.updateSet(
          patchSetSchema.parse({
            workoutId,
            exerciseId: entry.id,
            set: 1,
            updates: { isWarmup: true },
          }),
        )
      )._unsafeUnwrapErr().code,
    ).toBe("invalid_input");
    await operations.deleteWorkout({ workoutId });
  });
  it("refuses inherited schema creation and custom function privileges", async () => {
    await writer.query(
      `grant create on database ${admin.escapeIdentifier(databaseName)} to ${admin.escapeIdentifier(readerRole)}`,
    );
    try {
      await expect(
        provisionReader(
          databaseUrl.toString(),
          readerUrl.toString(),
          readerRole,
        ),
      ).rejects.toThrow("database CREATE");
    } finally {
      await writer.query(
        `revoke create on database ${admin.escapeIdentifier(databaseName)} from ${admin.escapeIdentifier(readerRole)}`,
      );
    }
    await writer.query("grant create on schema public to public");
    try {
      await expect(
        provisionReader(
          databaseUrl.toString(),
          readerUrl.toString(),
          readerRole,
        ),
      ).rejects.toThrow("schema CREATE");
    } finally {
      await writer.query("revoke create on schema public from public");
    }
    await writer.query(
      "create function public.mcp_secret() returns text language sql as $$ select 'secret' $$",
    );
    try {
      await expect(
        provisionReader(
          databaseUrl.toString(),
          readerUrl.toString(),
          readerRole,
        ),
      ).rejects.toThrow("non-system functions");
      await writer.query(
        "revoke execute on function public.mcp_secret() from public",
      );
      await expect(
        reader.query("select public.mcp_secret()"),
      ).rejects.toMatchObject({ code: "42501" });
    } finally {
      await writer.query("drop function public.mcp_secret()");
    }
  });
  it("rejects function privilege drift after provisioning", async () => {
    await writer.query(
      "create function fitness_data.lower(uuid) returns text language sql security definer as $$ select 'secret' $$",
    );
    try {
      expect(
        (
          await query({
            sql: "select lower('62b242cd-862f-4f47-9d88-68bbfb488727'::uuid)",
          })
        )._unsafeUnwrapErr(),
      ).toContain("non-system functions");
    } finally {
      await writer.query("drop function fitness_data.lower(uuid)");
    }
    expect(
      (
        await query({ sql: "select lower('HELLO') as greeting" })
      )._unsafeUnwrap().rows,
    ).toEqual([{ greeting: "hello" }]);
  });
  it("records, replaces, corrects, finishes and deletes without losing completed performance", async () => {
    const original = await exercise("Original");
    const replacement = await exercise("Replacement");
    const created = (
      await operations.createWorkout(
        createWorkoutSchema.parse({
          name: "Integration flow",
          start: "2025-01-01T10:00:00Z",
          exercises: [
            {
              exerciseId: original.id,
              sets: [
                { set: 1, reps: 10, weight: 20, isCompleted: true },
                {
                  set: 2,
                  targetReps: 12,
                  reps: 11,
                  weight: 25,
                  rpe: 8,
                  isFailure: true,
                },
              ],
            },
          ],
        }),
      )
    )._unsafeUnwrap();
    const workoutId = created.workout.id;
    expect((await repository.findById(workoutId))._unsafeUnwrap()).toEqual(
      created.workout,
    );
    const replaced = (
      await operations.replaceExercise({
        workoutId,
        oldExerciseId: original.id,
        newExerciseId: replacement.id,
      })
    )._unsafeUnwrap();
    expect(replaced.exerciseGroups.map((g) => g.exercise.id)).toEqual([
      original.id,
      replacement.id,
    ]);
    expect(replaced.exerciseGroups[0].sets[0]).toMatchObject({
      reps: 10,
      weight: 20,
      isCompleted: true,
    });
    expect(replaced.exerciseGroups[1].sets[0]).toMatchObject({
      set: 1,
      targetReps: 12,
      reps: undefined,
      weight: undefined,
      rpe: undefined,
      isFailure: false,
    });
    const input = {
      workoutId,
      exerciseId: replacement.id,
      sets: [
        { set: 1, reps: 8, weight: 30, isCompleted: true },
        { set: 2, reps: 20, weight: 10, isCompleted: true, isWarmup: true },
      ],
    };
    const first = (
      await operations.saveSets(saveSetsSchema.parse(input))
    )._unsafeUnwrap();
    expect(
      (await operations.saveSets(saveSetsSchema.parse(input)))._unsafeUnwrap(),
    ).toEqual(first);
    expect(
      (
        await operations.replaceExercise({
          workoutId,
          oldExerciseId: original.id,
          newExerciseId: replacement.id,
        })
      )._unsafeUnwrapErr().code,
    ).toBe("conflict");
    const finished = (
      await operations.finishWorkout({
        workoutId,
        stop: "2025-01-01T11:00:00Z",
      })
    )._unsafeUnwrap();
    expect(
      (await operations.finishWorkout({ workoutId }))._unsafeUnwrap().workout
        .stop,
    ).toEqual(finished.workout.stop);
    const volume = (
      await query({
        sql: `select muscle_group, sum(weighted_sets)::float8 as sets, sum(volume_kg)::float8 as volume from fitness_data.muscle_volume where workout_id = '${workoutId}' group by muscle_group order by muscle_group`,
      })
    )._unsafeUnwrap();
    expect(volume.rows).toEqual([
      { muscle_group: "pecs", sets: 1.6, volume: 352 },
      { muscle_group: "triceps", sets: 0.4, volume: 88 },
    ]);
    await operations.deleteSets({
      workoutId,
      exerciseId: replacement.id,
      sets: [1],
    });
    const remaining = (
      await query({
        sql: `select * from fitness_data.sets where workout_id = '${workoutId}'`,
      })
    )._unsafeUnwrap();
    expect(remaining.rowCount).toBe(2);
    await operations.removeExercise({ workoutId, exerciseId: replacement.id });
    expect(
      (
        await query({
          sql: `select * from fitness_data.sets where workout_id = '${workoutId}'`,
        })
      )._unsafeUnwrap().rowCount,
    ).toBe(1);
    await operations.deleteWorkout({ workoutId });
    expect(
      (
        await query({
          sql: `select * from fitness_data.sets where workout_id = '${workoutId}'`,
        })
      )._unsafeUnwrap().rows,
    ).toEqual([]);
  });
  it("saves completed history atomically, rejects invalid references and rolls back database failures", async () => {
    const entry = await exercise("Atomic");
    const name = randomUUID();
    const input = {
      name,
      start: "2025-02-01T10:00:00Z",
      stop: "2025-02-01T11:00:00Z",
      exercises: [
        {
          exerciseId: entry.id,
          sets: [{ set: 1, reps: 10, weight: 20, isCompleted: true }],
        },
      ],
    };
    expect(
      (
        await operations.createWorkout(
          createWorkoutSchema.parse({
            ...input,
            exercises: [...input.exercises, { exerciseId: randomUUID() }],
          }),
        )
      ).isErr(),
    ).toBe(true);
    expect(
      (await writer.query("select * from workouts where name = $1", [name]))
        .rowCount,
    ).toBe(0);
    await writer.query(
      "create function public.reject_mcp_test_set() returns trigger language plpgsql as $$ begin raise exception 'injected failure'; end $$",
    );
    await writer.query(
      "create trigger reject_mcp_test_set before insert on workout_sets for each row execute function public.reject_mcp_test_set()",
    );
    try {
      expect(
        (
          await operations.createWorkout(createWorkoutSchema.parse(input))
        ).isErr(),
      ).toBe(true);
    } finally {
      await writer.query("drop trigger reject_mcp_test_set on workout_sets");
      await writer.query("drop function public.reject_mcp_test_set()");
    }
    expect(
      (await writer.query("select * from workouts where name = $1", [name]))
        .rowCount,
    ).toBe(0);
    expect(
      (
        await operations.createWorkout(createWorkoutSchema.parse(input))
      )._unsafeUnwrap().workout.stop,
    ).toEqual(new Date(input.stop));
  });
  it("serializes concurrent set saves and supports bodyweight and explicit clearing", async () => {
    const entry = await exercise("Concurrent");
    const session = (
      await operations.createWorkout(
        createWorkoutSchema.parse({
          name: "Concurrent",
          exercises: [{ exerciseId: entry.id }],
        }),
      )
    )._unsafeUnwrap();
    const target = { workoutId: session.workout.id, exerciseId: entry.id };
    const results = await Promise.all(
      [1, 2, 3].map((set) =>
        operations.saveSets(
          saveSetsSchema.parse({
            ...target,
            sets: [{ set, reps: 10, isCompleted: true }],
          }),
        ),
      ),
    );
    expect(results.every((result) => result.isOk())).toBe(true);
    const updated = (
      await operations.updateSet({
        ...target,
        set: 1,
        updates: { note: "Keep flags" },
      })
    )._unsafeUnwrap();
    expect(updated.exerciseGroups[0].sets).toHaveLength(3);
    expect(updated.exerciseGroups[0].sets[0]).toMatchObject({
      isCompleted: true,
      reps: 10,
      weight: undefined,
      note: "Keep flags",
    });
    const cleared = (
      await operations.saveSets(
        saveSetsSchema.parse({
          ...target,
          sets: [{ set: 1, reps: null, note: null }],
        }),
      )
    )._unsafeUnwrap();
    expect(cleared.exerciseGroups[0].sets[0]).toMatchObject({
      reps: undefined,
      note: undefined,
      isCompleted: false,
    });
    expect(
      (await operations.deleteSets({ ...target, sets: [2, 99] })).isErr(),
    ).toBe(true);
    expect(
      (
        await operations.saveSets(
          saveSetsSchema.parse({
            ...target,
            exerciseId: randomUUID(),
            sets: [{ set: 1 }],
          }),
        )
      ).isErr(),
    ).toBe(true);
  });
  it("enforces database privileges independently of SQL validation", async () => {
    for (const table of [
      "auth_users",
      "auth_sessions",
      "auth_accounts",
      "auth_verifications",
      "auth_invitations",
    ]) {
      await expect(
        reader.query(`select * from public.${table}`),
      ).rejects.toMatchObject({ code: "42501" });
    }
    await expect(
      reader.query("select * from public.workouts"),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      reader.query("select * from public.oauth_tokens"),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      reader.query("delete from fitness_data.workouts"),
    ).rejects.toBeDefined();
    const disguised = createQueryRunner(
      ownerUserId,
      async () => {
        const connection = await writer.connect();
        await connection.query(
          `set role ${admin.escapeIdentifier(readerRole)}`,
        );
        return connection;
      },
      readerRole,
    );
    expect((await disguised({ sql: "select 1" })).isErr()).toBe(true);
    const client = await reader.connect();
    try {
      await client.query("begin read write");
      await expect(
        client.query("delete from fitness_data.workouts"),
      ).rejects.toMatchObject({ code: "42501" });
    } finally {
      await client.query("rollback");
      client.release();
    }
    expect(
      (
        await createQueryRunner(ownerUserId, () => writer.connect())({
          sql: "select 1",
        })
      ).isErr(),
    ).toBe(true);
  });
  it("supports schema examples, CTEs and windows; bounds rows, bytes and query time", async () => {
    for (const sql of [
      "select * from pg_roles where exists (with pg_roles as (select * from workouts) select 1)",
      "with pg_roles as (select * from pg_roles) select * from pg_roles",
      "with x as (select * from pg_roles), pg_roles as (select * from workouts) select * from x",
    ])
      expect((await query({ sql })).isErr(), sql).toBe(true);
    for (const sql of schemaDescription.examples)
      expect((await query({ sql })).isOk(), sql).toBe(true);
    expect(
      (
        await query({
          sql: "with entries as (select id, name from fitness_data.exercises) select name, row_number() over (order by name) as n from entries",
        })
      ).isOk(),
    ).toBe(true);
    const capped = (
      await query({ sql: "select generate_series(1, 510) as n" })
    )._unsafeUnwrap();
    expect(capped).toMatchObject({ rowCount: 500, truncated: true });
    const large = (
      await query({
        sql: "select string_agg('abcdefghij', '') as large from generate_series(1, 30000)",
      })
    )._unsafeUnwrap();
    expect(large).toEqual({ rows: [], rowCount: 0, truncated: true });
    expect(
      (
        await query({
          sql: "select sum(n) from generate_series(1, 1000000000) n",
        })
      )._unsafeUnwrapErr(),
    ).toContain("time limit");
    expect((await query({ sql: "select 1 as healthy" })).isOk()).toBe(true);
  });
});

describe("habit MCP reads", () => {
  it("exposes active definitions and dated history without underlying table access", async () => {
    const activeId = randomUUID();
    const inactiveId = randomUUID();
    try {
      await writer.query(
        `insert into habits (user_id, id, name, identity_phrase, minimal_version, frequency_type, frequency_config, target_count, start_date, is_active)
         values ($3, $1, 'Read', 'I keep learning', 'Read one page', 'weekly', '{"days_of_week":[1,3]}', 1, '2025-01-01', true),
                ($3, $2, 'Archived', '', '', 'daily', '{}', 1, '2025-01-01', false)`,
        [activeId, inactiveId, ownerUserId],
      );
      await writer.query(
        `insert into habit_completions (habit_id, completion_date, completed, notes)
         values ($1, '2025-01-06', true, 'one page'),
                ($1, '2025-01-08', false, null),
                ($2, '2025-01-06', true, null)`,
        [activeId, inactiveId],
      );
      await writer.query(
        `insert into habit_completions (habit_id, completion_date, completed, deleted_at)
         values ($1, '2025-01-10', true, now())`,
        [activeId],
      );
      const definitions = (
        await query({
          sql: `select id, identity_phrase, minimal_version, frequency_type, frequency_config from fitness_data.habits where id in ('${activeId}', '${inactiveId}')`,
        })
      )._unsafeUnwrap().rows;
      expect(definitions).toEqual([
        {
          id: activeId,
          identity_phrase: "I keep learning",
          minimal_version: "Read one page",
          frequency_type: "weekly",
          frequency_config: { days_of_week: [1, 3] },
        },
      ]);
      expect(
        (
          await query({
            sql: `select habit_id, completion_date, completed, notes from fitness_data.habit_completions where habit_id in ('${activeId}', '${inactiveId}') order by completion_date`,
          })
        )._unsafeUnwrap().rows,
      ).toEqual([
        {
          habit_id: activeId,
          completion_date: "2025-01-06",
          completed: true,
          notes: "one page",
        },
        {
          habit_id: activeId,
          completion_date: "2025-01-08",
          completed: false,
          notes: null,
        },
      ]);
      await expect(
        reader.query("select * from public.habits"),
      ).rejects.toMatchObject({
        code: "42501",
      });
      await expect(
        reader.query("select * from public.habit_completions"),
      ).rejects.toMatchObject({ code: "42501" });
      await writer.query("update habits set deleted_at = now() where id = $1", [
        activeId,
      ]);
      expect(
        (
          await query({
            sql: `select * from fitness_data.habit_completions where habit_id = '${activeId}'`,
          })
        )._unsafeUnwrap().rows,
      ).toEqual([]);
    } finally {
      await writer.query(
        "delete from habit_completions where habit_id in ($1, $2)",
        [activeId, inactiveId],
      );
      await writer.query("delete from habits where id in ($1, $2)", [
        activeId,
        inactiveId,
      ]);
    }
  });
});

describe("nutrition MCP", () => {
  it("creates, queries, corrects and deletes meals through the SDK with boundary validation", async () => {
    const server = new McpServer({ name: "nutrition test", version: "1" });
    registerFitnessTools(server, operations, query, nutrition);
    const client = new McpClient({ name: "nutrition client", version: "1" });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    const call = (name: string, args: Record<string, unknown>) =>
      client.callTool({ name, arguments: args });
    try {
      const food = {
        name: `Food ${randomUUID()}`,
        category: "proteins",
        calories: 200,
        protein: 20,
        carbs: 10,
        fat: 8,
        fiber: 2,
        waterPercentage: 60,
        energyDensity: 2,
        texture: "firm_solid",
        isVegetarian: true,
        isVegan: true,
      };
      const created = await call("create_ingredient", food);
      expect(created.isError).toBe(false);
      const { ingredient } = z
        .object({ ingredient: z.object({ id: z.uuid() }) })
        .parse(created.structuredContent);
      expect(
        (await call("create_ingredient", food)).structuredContent,
      ).toMatchObject({ error: { code: "conflict" } });
      for (const invalid of [
        { ...food, protein: -1 },
        { ...food, sliderMin: 10, sliderMax: 5 },
      ])
        expect((await call("create_ingredient", invalid)).isError).toBe(true);
      const input = {
        loggedDate: "2025-03-01",
        mealCategory: "lunch",
        notes: "Keep notes",
        ingredients: [{ id: ingredient.id, quantity: 150 }],
      };
      for (const invalid of [
        { ...input, loggedDate: "2025-02-30" },
        { ...input, ingredients: [] },
        { ...input, ingredients: [input.ingredients[0], input.ingredients[0]] },
        { ...input, ingredients: [{ id: ingredient.id, quantity: -1 }] },
      ])
        expect((await call("log_meal", invalid)).isError).toBe(true);
      const logged = await call("log_meal", input);
      expect(logged.isError).toBe(false);
      const { meal } = z
        .object({ meal: z.object({ id: z.uuid(), isCompleted: z.boolean() }) })
        .parse(logged.structuredContent);
      expect(meal.isCompleted).toBe(false);
      expect((await call("log_meal", input)).structuredContent).toMatchObject({
        error: { code: "conflict" },
      });
      const totalsSql = `select sum(i.calories * mi.quantity_grams / 100) as calories from fitness_data.meal_log_ingredients mi join fitness_data.ingredients i on i.id = mi.ingredient_id where mi.meal_log_id = '${meal.id}'`;
      expect(
        (await call("query", { sql: totalsSql })).structuredContent,
      ).toMatchObject({ rows: [{ calories: 300 }] });
      expect(
        (
          await call("update_meal_log", {
            mealId: meal.id,
            ingredients: [{ id: randomUUID(), quantity: 10 }],
          })
        ).structuredContent,
      ).toMatchObject({ error: { code: "not_found" } });
      expect((await query({ sql: totalsSql }))._unsafeUnwrap().rows).toEqual([
        { calories: 300 },
      ]);
      const update = {
        mealId: meal.id,
        ingredients: [{ id: ingredient.id, quantity: 200 }],
        isCompleted: true,
      };
      for (let i = 0; i < 2; i++) {
        expect(
          (await call("update_meal_log", update)).structuredContent,
        ).toMatchObject({ meal: { notes: "Keep notes", isCompleted: true } });
      }
      expect((await query({ sql: totalsSql }))._unsafeUnwrap().rows).toEqual([
        { calories: 400 },
      ]);
      expect(
        (await call("update_meal_log", { ...update, mealId: randomUUID() }))
          .structuredContent,
      ).toMatchObject({ error: { code: "not_found" } });
      for (let i = 0; i < 2; i++)
        expect(
          (await call("delete_meal_log", { mealId: meal.id })).isError,
        ).toBe(false);
      expect(
        (
          await query({
            sql: `select * from fitness_data.meal_logs where id = '${meal.id}'`,
          })
        )._unsafeUnwrap().rows,
      ).toEqual([]);
      expect(
        (
          await query({
            sql: `select * from fitness_data.meal_log_ingredients where meal_log_id = '${meal.id}'`,
          })
        )._unsafeUnwrap().rows,
      ).toEqual([]);
      expect((await call("update_meal_log", update)).isError).toBe(true);
      expect((await call("log_meal", input)).isError).toBe(false);
      await expect(
        reader.query("select * from public.ingredients"),
      ).rejects.toMatchObject({ code: "42501" });
      await expect(
        reader.query("delete from fitness_data.meal_logs"),
      ).rejects.toBeDefined();
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("exposes templates and compositions while filtering deleted rows and parents", async () => {
    const food = (
      await nutrition.createIngredient({
        name: `Template food ${randomUUID()}`,
        category: "other",
        calories: 100,
        protein: 1,
        carbs: 1,
        fat: 1,
        fiber: 1,
        waterPercentage: 50,
        energyDensity: 1,
        texture: "soft_solid",
        isVegetarian: true,
        isVegan: true,
        sliderMin: 5,
        sliderMax: 500,
      })
    )._unsafeUnwrap().ingredient;
    const templateId = randomUUID();
    await writer.query(
      `insert into meal_templates (id, name, categories, total_calories, total_protein, total_carbs, total_fat, total_fiber, satiety_score) values ($1, 'Template', array['breakfast']::meal_category[], 100, 1, 1, 1, 1, 1)`,
      [templateId],
    );
    await writer.query(
      `insert into meal_template_ingredients (meal_template_id, ingredient_id, quantity_grams) values ($1, $2, 100)`,
      [templateId, food.id],
    );
    const meal = (
      await createMealLogRepository(database).save({
        mealCategory: "breakfast",
        loggedDate: new Date("2025-04-01T00:00:00Z"),
        mealTemplateId: templateId,
        ingredients: [{ ingredient: food, quantityGrams: 100 }],
      })
    )._unsafeUnwrap();
    const compositionSql = `select ingredient_id, quantity_grams from fitness_data.meal_template_ingredients where meal_template_id = '${templateId}'`;
    expect((await query({ sql: compositionSql }))._unsafeUnwrap().rows).toEqual(
      [{ ingredient_id: food.id, quantity_grams: 100 }],
    );
    await writer.query(
      "update meal_template_ingredients set deleted_at = now() where meal_template_id = $1",
      [templateId],
    );
    expect((await query({ sql: compositionSql }))._unsafeUnwrap().rows).toEqual(
      [],
    );
    await writer.query(
      "update meal_template_ingredients set deleted_at = null where meal_template_id = $1",
      [templateId],
    );
    await writer.query(
      "update meal_templates set deleted_at = now() where id = $1",
      [templateId],
    );
    expect((await query({ sql: compositionSql }))._unsafeUnwrap().rows).toEqual(
      [],
    );
    expect(
      (
        await query({
          sql: `select * from fitness_data.meal_templates where id = '${templateId}'`,
        })
      )._unsafeUnwrap().rows,
    ).toEqual([]);
    expect(
      (
        await query({
          sql: `select meal_template_id from fitness_data.meal_logs where id = '${meal.id}'`,
        })
      )._unsafeUnwrap().rows,
    ).toEqual([{ meal_template_id: null }]);
    expect(
      (
        await query({
          sql: `select ingredient_id from fitness_data.meal_log_ingredients where meal_log_id = '${meal.id}'`,
        })
      )._unsafeUnwrap().rows,
    ).toEqual([{ ingredient_id: food.id }]);
  });

  it("allows only one concurrent log per date/category and rolls back failed composition updates", async () => {
    const ingredient = (
      await nutrition.createIngredient({
        name: `Concurrent ${randomUUID()}`,
        category: "other",
        calories: 100,
        protein: 1,
        carbs: 1,
        fat: 1,
        fiber: 1,
        waterPercentage: 50,
        energyDensity: 1,
        texture: "soft_solid",
        isVegetarian: true,
        isVegan: true,
        sliderMin: 5,
        sliderMax: 500,
      })
    )._unsafeUnwrap().ingredient;
    const input = logMealSchema.parse({
      loggedDate: "2025-03-02",
      mealCategory: "dinner",
      ingredients: [{ id: ingredient.id, quantity: 100 }],
    });
    const results = await Promise.all([
      nutrition.logMeal(input),
      nutrition.logMeal(input),
    ]);
    expect(results.filter((result) => result.isOk())).toHaveLength(1);
    expect(
      results
        .filter((result) => result.isErr())
        .map((result) => result._unsafeUnwrapErr().code),
    ).toEqual(["conflict"]);
    const saved = results.find((result) => result.isOk());
    if (!saved) throw new Error("Expected one saved meal");
    const mealId = saved._unsafeUnwrap().meal.id;
    // A real database failure after the metadata update must roll back the transaction.
    const failed = await createMealLogRepository(database).update(mealId, {
      notes: "Should roll back",
      ingredients: [{ ingredient, quantityGrams: -1 }],
    });
    expect(failed.isErr()).toBe(true);
    const persisted = (
      await createMealLogRepository(database).fetchWithIngredients(mealId)
    )._unsafeUnwrap();
    expect(persisted.notes).toBeNull();
    expect(persisted.ingredients[0].quantityGrams).toBe(100);
    await writer.query(
      "update ingredients set deleted_at = now() where id = $1",
      [ingredient.id],
    );
    expect(
      (
        await query({
          sql: `select * from fitness_data.meal_log_ingredients where meal_log_id = '${mealId}'`,
        })
      )._unsafeUnwrap().rows,
    ).toEqual([]);
    expect(
      (
        await nutrition.logMeal({ ...input, loggedDate: "2025-03-03" })
      )._unsafeUnwrapErr().code,
    ).toBe("not_found");
  });
});

describe("progress reads through MCP", () => {
  it("preserves dated weight records and persisted target semantics without base-table access", async () => {
    const server = new McpServer({ name: "progress test", version: "1" });
    registerFitnessTools(server, operations, query, nutrition);
    const client = new McpClient({ name: "progress client", version: "1" });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    const targetId = randomUUID();
    const deletedId = randomUUID();
    const otherId = randomUUID();
    const rowsSchema = z.object({
      rows: z.array(z.record(z.string(), z.unknown())),
      rowCount: z.number(),
      truncated: z.boolean(),
    });
    const read = async (sql: string) => {
      const result = await client.callTool({
        name: "query",
        arguments: { sql },
      });
      expect(result.isError).toBe(false);
      return rowsSchema.parse(result.structuredContent);
    };
    try {
      await writer.query(
        "insert into measurements (user_id, name, unit) values ($1, 'weight', 'kg'), ($1, 'daily_calorie_intake', 'Cal'), ($1, 'progress_other', 'cm') on conflict do nothing",
        [ownerUserId],
      );
      await writer.query(
        "insert into measures (user_id, measurement_name, t, value) values ($1, 'weight', '1904-05-06 08:30:00', 81.5), ($1, 'weight', '1904-05-06 19:45:00', 82), ($1, 'weight', '1904-05-07 08:00:00', 0), ($1, 'progress_other', '1904-05-06 08:30:00', 99)",
        [ownerUserId],
      );
      const schema = await client.callTool({
        name: "describe_schema",
        arguments: {},
      });
      expect(schema.structuredContent).toMatchObject({
        views: {
          body_weight_history: {
            primaryKey: ["measurement_name", "recorded_at"],
          },
          active_calorie_target: { primaryKey: ["id"] },
        },
      });
      const history = await read(
        "select measurement_name, recorded_at, weight_kg, unit from fitness_data.body_weight_history order by recorded_at desc",
      );
      expect(history).toEqual({
        rowCount: 3,
        truncated: false,
        rows: [
          {
            measurement_name: "weight",
            recorded_at: "1904-05-07T08:00:00+00:00",
            weight_kg: 0,
            unit: "kg",
          },
          {
            measurement_name: "weight",
            recorded_at: "1904-05-06T19:45:00+00:00",
            weight_kg: 82,
            unit: "kg",
          },
          {
            measurement_name: "weight",
            recorded_at: "1904-05-06T08:30:00+00:00",
            weight_kg: 81.5,
            unit: "kg",
          },
        ],
      });
      expect(
        (
          await read(
            "select recorded_at, weight_kg from body_weight_history where recorded_at >= '1904-05-06T00:00:00Z'::timestamptz and recorded_at < '1904-05-07T00:00:00Z'::timestamptz order by recorded_at",
          )
        ).rowCount,
      ).toBe(2);
      const appWeights = await writer.query(
        "select t at time zone 'UTC' as recorded_at, value from measures where measurement_name = 'weight' order by t desc",
      );
      expect(
        history.rows.map((row) => ({
          t: new Date(z.string().parse(row.recorded_at)).toISOString(),
          value: row.weight_kg,
        })),
      ).toEqual(
        appWeights.rows.map((row) => ({
          t: row.recorded_at.toISOString(),
          value: row.value,
        })),
      );
      expect(await read("select * from active_calorie_target")).toEqual({
        rows: [],
        rowCount: 0,
        truncated: false,
      });
      await writer.query(
        "insert into targets (user_id, id, measurement_name, value, deleted_at) values ($4, $1, 'daily_calorie_intake', 2300, null), ($4, $2, 'daily_calorie_intake', 1800, now()), ($4, $3, 'progress_other', 99, null)",
        [targetId, deletedId, otherId, ownerUserId],
      );
      const target = await read("select * from active_calorie_target");
      expect(target).toEqual({
        rowCount: 1,
        truncated: false,
        rows: [
          {
            id: targetId,
            measurement_name: "daily_calorie_intake",
            calories_kcal_per_day: 2300,
            unit: "kcal",
            source: "persisted_target",
          },
        ],
      });
      const appTarget = await writer.query(
        "select id, value from targets where measurement_name = 'daily_calorie_intake' and deleted_at is null",
      );
      expect(
        target.rows.map((row) => ({
          id: row.id,
          value: row.calories_kcal_per_day,
        })),
      ).toEqual(appTarget.rows);
      await writer.query("update targets set value = 0 where id = $1", [
        targetId,
      ]);
      expect(
        (await read("select calories_kcal_per_day from active_calorie_target"))
          .rows,
      ).toEqual([{ calories_kcal_per_day: 0 }]);
      await writer.query(
        "update targets set deleted_at = now() where id = $1",
        [targetId],
      );
      expect(await read("select * from active_calorie_target")).toEqual({
        rows: [],
        rowCount: 0,
        truncated: false,
      });
      const connection = await reader.connect();
      try {
        await connection.query("set timezone = 'Pacific/Auckland'");
        await connection.query("begin read only");
        await connection.query(
          "select set_config('fitness.user_id', $1, true)",
          [ownerUserId],
        );
        const alternateZone = await connection.query(
          "select recorded_at from fitness_data.body_weight_history order by recorded_at desc",
        );
        expect(
          alternateZone.rows.map((row) => row.recorded_at.toISOString()),
        ).toEqual(
          history.rows.map((row) =>
            new Date(z.string().parse(row.recorded_at)).toISOString(),
          ),
        );
      } finally {
        await connection.query("rollback");
        await connection.query("set timezone = 'UTC'");
        connection.release();
      }
      for (const table of ["measures", "targets"]) {
        await expect(
          reader.query(`select * from public.${table}`),
        ).rejects.toMatchObject({ code: "42501" });
        expect(
          (
            await client.callTool({
              name: "query",
              arguments: { sql: `select * from public.${table}` },
            })
          ).isError,
        ).toBe(true);
      }
      for (const view of ["body_weight_history", "active_calorie_target"]) {
        await expect(
          reader.query(`delete from fitness_data.${view}`),
        ).rejects.toBeDefined();
        expect(
          (
            await client.callTool({
              name: "query",
              arguments: { sql: `delete from fitness_data.${view}` },
            })
          ).isError,
        ).toBe(true);
      }
    } finally {
      await writer.query("delete from targets where id = any($1::uuid[])", [
        [targetId, deletedId, otherId],
      ]);
      await writer.query(
        "delete from measures where t >= '1904-05-06' and t < '1904-05-08'",
      );
      await writer.query(
        "delete from measurements where name = 'progress_other'",
      );
      await client.close();
      await server.close();
    }
  });
});

describe("personal habit SQL isolation", () => {
  it("scopes joins and aggregates to the trusted user and clears pooled transaction identity", async () => {
    const otherUserId = userIdSchema.parse(randomUUID());
    const ownerHabitId = randomUUID();
    const otherHabitId = randomUUID();
    const otherQuery = createQueryRunner(
      otherUserId,
      () => reader.connect(),
      readerRole,
    );
    try {
      await writer.query(
        "insert into auth_users (id, name, email) values ($1, 'Other test user', $2)",
        [otherUserId, `${otherUserId}@example.invalid`],
      );
      await writer.query(
        `insert into habits (user_id, id, name, frequency_type, start_date)
        values ($1, $2, 'Owner private habit', 'daily', '2020-01-01'),
               ($3, $4, 'Other private habit', 'daily', '2020-01-01')`,
        [ownerUserId, ownerHabitId, otherUserId, otherHabitId],
      );
      await writer.query(
        `insert into habit_completions (habit_id, completion_date, completed, notes)
        values ($1, '2020-01-01', true, 'Owner private note'),
               ($2, '2020-01-01', true, 'Other private note')`,
        [ownerHabitId, otherHabitId],
      );
      const sql =
        "select h.id, c.notes from fitness_data.habits h join fitness_data.habit_completions c on c.habit_id=h.id order by h.id";
      const [owner, other] = await Promise.all([
        query({ sql }),
        otherQuery({ sql }),
      ]);
      expect(owner._unsafeUnwrap().rows).toEqual([
        { id: ownerHabitId, notes: "Owner private note" },
      ]);
      expect(other._unsafeUnwrap().rows).toEqual([
        { id: otherHabitId, notes: "Other private note" },
      ]);
      expect(
        (
          await otherQuery({
            sql: "select count(*)::integer as n from fitness_data.habits",
          })
        )._unsafeUnwrap().rows,
      ).toEqual([{ n: 1 }]);
      expect((await query({ sql }))._unsafeUnwrap().rows).toEqual([
        { id: ownerHabitId, notes: "Owner private note" },
      ]);
      expect(
        (await reader.query("select * from fitness_data.habits")).rows,
      ).toEqual([]);
      expect(
        (await reader.query("select * from fitness_data.habit_completions"))
          .rows,
      ).toEqual([]);
      expect(
        (
          await otherQuery({
            sql: `select set_config('fitness.user_id', '${ownerUserId}', true)`,
          })
        ).isErr(),
      ).toBe(true);
      expect(
        (
          await otherQuery({ sql: "select current_setting('fitness.user_id')" })
        ).isErr(),
      ).toBe(true);
      expect((await otherQuery({ sql }))._unsafeUnwrap().rows).toEqual([
        { id: otherHabitId, notes: "Other private note" },
      ]);
    } finally {
      await writer.query(
        "delete from habit_completions where habit_id=any($1::uuid[])",
        [[ownerHabitId, otherHabitId]],
      );
      await writer.query("delete from habits where id=any($1::uuid[])", [
        [ownerHabitId, otherHabitId],
      ]);
      await writer.query("delete from auth_users where id=$1", [otherUserId]);
    }
  });
});

describe("personal progress SQL isolation", () => {
  it("isolates body weight and calorie targets across parallel accounts and missing identity", async () => {
    const otherUserId = userIdSchema.parse(randomUUID());
    const ownerTargetId = randomUUID();
    const otherTargetId = randomUUID();
    const otherQuery = createQueryRunner(
      otherUserId,
      () => reader.connect(),
      readerRole,
    );
    try {
      await writer.query(
        "insert into auth_users (id,name,email) values ($1,'Other progress account',$2)",
        [otherUserId, `${otherUserId}@example.invalid`],
      );
      await writer.query(
        `insert into measurements (user_id,name,unit)
        values ($1,'weight','kg'),($1,'daily_calorie_intake','Cal'),
               ($2,'weight','kg'),($2,'daily_calorie_intake','Cal') on conflict do nothing`,
        [ownerUserId, otherUserId],
      );
      await writer.query(
        "insert into measures (user_id,measurement_name,t,value) values ($1,'weight','1890-01-01',80),($2,'weight','1890-01-01',50)",
        [ownerUserId, otherUserId],
      );
      await writer.query(
        "insert into targets (user_id,id,measurement_name,value) values ($1,$2,'daily_calorie_intake',2300),($3,$4,'daily_calorie_intake',1800)",
        [ownerUserId, ownerTargetId, otherUserId, otherTargetId],
      );
      const sql =
        "select avg(w.weight_kg)::float8 as weight, max(t.calories_kcal_per_day)::float8 as calories from fitness_data.body_weight_history w cross join fitness_data.active_calorie_target t";
      const [owner, other] = await Promise.all([
        query({ sql }),
        otherQuery({ sql }),
      ]);
      expect(owner._unsafeUnwrap().rows).toEqual([
        { weight: 80, calories: 2300 },
      ]);
      expect(other._unsafeUnwrap().rows).toEqual([
        { weight: 50, calories: 1800 },
      ]);
      expect(
        (await reader.query("select * from fitness_data.body_weight_history"))
          .rows,
      ).toEqual([]);
      expect(
        (await reader.query("select * from fitness_data.active_calorie_target"))
          .rows,
      ).toEqual([]);
      for (const table of ["measurements", "daily_note"])
        await expect(
          reader.query(`select * from public.${table}`),
        ).rejects.toMatchObject({ code: "42501" });
      expect((await query({ sql }))._unsafeUnwrap().rows).toEqual([
        { weight: 80, calories: 2300 },
      ]);
      expect((await otherQuery({ sql }))._unsafeUnwrap().rows).toEqual([
        { weight: 50, calories: 1800 },
      ]);
    } finally {
      await writer.query("delete from targets where id=any($1::uuid[])", [
        [ownerTargetId, otherTargetId],
      ]);
      await writer.query(
        "delete from measures where user_id=any($1::uuid[]) and t='1890-01-01'",
        [[ownerUserId, otherUserId]],
      );
      await writer.query("delete from measurements where user_id=$1", [
        otherUserId,
      ]);
      await writer.query("delete from auth_users where id=$1", [otherUserId]);
    }
  });
});

it("isolates workout sessions, ordered groups, sets and volume for the real A/B SQL reader", async () => {
  const otherUserId = userIdSchema.parse(randomUUID());
  const otherOperations = workoutOperations(
    createWorkoutRepository(otherUserId, database),
  );
  const otherQuery = createQueryRunner(
    otherUserId,
    () => reader.connect(),
    readerRole,
  );
  await writer.query(
    "insert into auth_users (id,name,email) values ($1,'Other workout fixture',$2)",
    [otherUserId, `${otherUserId}@example.invalid`],
  );
  const entry = await exercise("Reader isolation neutral exercise");
  const workoutIds: string[] = [];
  try {
    for (const [operation, name, reps, weight] of [
      [operations, "Account A private workout", 8, 60],
      [otherOperations, "Account B private workout", 3, 10],
    ] as const) {
      const session = (
        await operation.createWorkout({
          name,
          start: "1900-01-01T10:00:00Z",
          stop: "1900-01-01T11:00:00Z",
          notes: name,
          exercises: [
            {
              exerciseId: entry.id,
              notes: name,
              sets: [
                {
                  set: 1,
                  reps,
                  weight,
                  note: name,
                  isCompleted: true,
                  isWarmup: false,
                  isFailure: false,
                },
              ],
            },
          ],
        })
      )._unsafeUnwrap();
      workoutIds.push(session.workout.id);
    }
    const sql =
      "select w.id,w.notes,we.notes as exercise_notes,s.note,s.volume_kg from fitness_data.workouts w join fitness_data.workout_exercises we on we.workout_id=w.id join fitness_data.sets s on s.workout_id=we.workout_id and s.exercise_id=we.exercise_id where w.id in ('" +
      workoutIds.join("','") +
      "') order by w.id";
    const [a, b] = await Promise.all([query({ sql }), otherQuery({ sql })]);
    expect(a._unsafeUnwrap().rows).toEqual([
      {
        id: workoutIds[0],
        notes: "Account A private workout",
        exercise_notes: "Account A private workout",
        note: "Account A private workout",
        volume_kg: 480,
      },
    ]);
    expect(b._unsafeUnwrap().rows).toEqual([
      {
        id: workoutIds[1],
        notes: "Account B private workout",
        exercise_notes: "Account B private workout",
        note: "Account B private workout",
        volume_kg: 30,
      },
    ]);
    for (const view of [
      "workouts",
      "workout_exercises",
      "sets",
      "muscle_volume",
    ])
      expect(
        (await reader.query(`select * from fitness_data.${view}`)).rows,
      ).toEqual([]);
    const aggregateSql =
      "select sum(volume_kg)::float8 as total from fitness_data.sets where workout_id in ('" +
      workoutIds.join("','") +
      "')";
    for (const [run, total] of [
      [query, 480],
      [otherQuery, 30],
      [query, 480],
    ] as const)
      expect((await run({ sql: aggregateSql }))._unsafeUnwrap().rows).toEqual([
        { total },
      ]);
    await expect(
      reader.query("select * from public.workout_templates"),
    ).rejects.toThrow();
  } finally {
    await writer.query(
      "delete from workout_sets where workout=any($1::uuid[])",
      [workoutIds],
    );
    await writer.query(
      "delete from workout_exercises where workout_id=any($1::uuid[])",
      [workoutIds],
    );
    await writer.query("delete from workouts where id=any($1::uuid[])", [
      workoutIds,
    ]);
    await writer.query("delete from exercise_muscle_groups where exercise=$1", [
      entry.id,
    ]);
    await writer.query("delete from exercises where id=$1", [entry.id]);
    await writer.query("delete from auth_users where id=$1", [otherUserId]);
  }
});
