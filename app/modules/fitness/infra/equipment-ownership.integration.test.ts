import { randomUUID } from "node:crypto";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { userIdSchema } from "~/modules/auth/domain/user";
import { bootstrapAuthOwner } from "~/modules/auth/infra/owner-bootstrap.server";
import { createDisposablePostgres } from "../../../../tests/integration/support/disposable-postgres";
import { createEquipmentRepository } from "./adaptive-workout-repository.server";

const fixture = createDisposablePostgres(
  new URL(z.url().parse(process.env.TENANT_TEST_ADMIN_URL)),
);
const { database, pool } = fixture;
const owner = userIdSchema.parse(randomUUID());
const other = userIdSchema.parse(randomUUID());
const floors = [randomUUID(), randomUUID()];
const equipment = [randomUUID(), randomUUID()];
const workout = randomUUID();
const tables = [
  "gym_floors",
  "equipment_instances",
  "equipment_preferences",
  "training_preferences",
  "generation_conversations",
];
const records = () =>
  Promise.all(
    tables.map(
      async (table) =>
        (await pool.query(`select * from ${table} order by 1,2`)).rows,
    ),
  );
let original: readonly (readonly Record<string, unknown>[])[] = [];
beforeAll(async () => {
  await fixture.create();
  await fixture.migrateBefore(18);
  await pool.query(
    "insert into auth_users (id,name,email) values ($1,'Historical owner',$2)",
    [owner, `${owner}@example.invalid`],
  );
  await pool.query(
    "insert into workouts (id,user_id,name,start) values ($1,$2,'Own conversation fixture','1900-01-01')",
    [workout, owner],
  );
  for (const [index, id] of floors.entries()) {
    const archived = index === 1 ? new Date("1900-01-02") : null;
    await pool.query(
      "insert into gym_floors (id,name,floor_number,description,deleted_at) values ($1,$2,$3,'Private gym notes',$4)",
      [id, `Historical floor ${id}`, index + 1, archived],
    );
    await pool.query(
      "insert into equipment_instances (id,name,exercise_type,gym_floor_id,is_available,capacity,deleted_at) values ($1,$2,'machine',$3,true,2,$4)",
      [equipment[index], `Historical equipment ${id}`, id, archived],
    );
    await pool.query(
      "insert into equipment_preferences (muscle_group,exercise_type,preference_score,deleted_at) values ('pecs',$1,8,$2)",
      [index ? "cable" : "machine", archived],
    );
    await pool.query(
      "insert into training_preferences (content,source,deleted_at) values ('Historical personal preference','refinement',$1)",
      [archived],
    );
    await pool.query(
      'insert into generation_conversations (workout_id,messages,context_snapshot,model,total_tokens,deleted_at) values ($2,\'[{"role":"user","content":"Private conversation"}]\',\'{"notes":"Private context"}\',\'retired-fixture\',123,$1)',
      [archived, workout],
    );
  }
  original = await records();
});
afterAll(() => fixture.close());

describe.sequential("private equipment and retained preference history", () => {
  it("rolls back all DDL and retained history without an accepted owner", async () => {
    await expect(
      migrate(database, { migrationsFolder: "./drizzle" }),
    ).rejects.toThrow();
    expect(await records()).toEqual(original);
  });
  it("rejects ambiguous ownership and preserves every legacy ID, field, JSON and archive", async () => {
    for (const id of [owner, other])
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
    await pool.query("delete from auth_users where id=$1", [other]);
    await migrate(database, { migrationsFolder: "./drizzle" });
    // Ownership leads the composite preference key; compare records independently of query ordering.
    const normalize = (rows: readonly Record<string, unknown>[]) =>
      [...rows].sort((a, b) =>
        JSON.stringify(a).localeCompare(JSON.stringify(b)),
      );
    expect((await records()).map(normalize)).toEqual(
      original.map((rows) =>
        normalize(rows.map((row) => ({ ...row, user_id: owner }))),
      ),
    );
    await pool.query(
      "insert into auth_users (id,name,email) values ($1,'Other fixture',$2)",
      [other, `${other}@example.invalid`],
    );
  });
  it("isolates available equipment and preferences, rejects foreign availability writes", async () => {
    const a = createEquipmentRepository(owner, database);
    const b = createEquipmentRepository(other, database);
    expect(
      (await a.getAvailableEquipment())._unsafeUnwrap().map((row) => row.id),
    ).toEqual([equipment[0]]);
    expect((await b.getAvailableEquipment())._unsafeUnwrap()).toEqual([]);
    expect((await a.getEquipmentPreferences())._unsafeUnwrap()).toEqual([
      { muscleGroup: "pecs", exerciseType: "machine", preferenceScore: 8 },
    ]);
    expect((await b.getEquipmentPreferences())._unsafeUnwrap()).toEqual([]);
    const before = await records();
    expect(
      (
        await b.updateEquipmentAvailability(equipment[0], false)
      )._unsafeUnwrapErr(),
    ).toBe("not_found");
    expect(await records()).toEqual(before);
    expect(
      (await a.updateEquipmentAvailability(equipment[0], false)).isOk(),
    ).toBe(true);
    expect((await a.getAvailableEquipment())._unsafeUnwrap()).toEqual([]);
    expect(
      (await a.updateEquipmentAvailability(equipment[0], true)).isOk(),
    ).toBe(true);
  });
  it("allows independent floor/preference keys and enforces equipment-floor and conversation-workout ownership", async () => {
    const floor = randomUUID();
    await pool.query(
      "insert into gym_floors (id,user_id,name,floor_number) values ($1,$2,'Other floor',1)",
      [floor, other],
    );
    await pool.query(
      "insert into equipment_preferences (user_id,muscle_group,exercise_type,preference_score) values ($1,'pecs','machine',2)",
      [other],
    );
    await expect(
      pool.query(
        "insert into equipment_instances (user_id,name,exercise_type,gym_floor_id) values ($1,'Forged floor','machine',$2)",
        [other, floors[0]],
      ),
    ).rejects.toThrow();
    await expect(
      pool.query(
        "insert into generation_conversations (user_id,workout_id,model,context_snapshot) values ($1,$2,'forged','{}')",
        [other, workout],
      ),
    ).rejects.toThrow();
    await pool.query(
      "insert into generation_conversations (user_id,workout_id,model,context_snapshot) values ($1,$2,'owned','{}')",
      [owner, workout],
    );
    expect(
      (
        await createEquipmentRepository(
          other,
          database,
        ).getEquipmentPreferences()
      )._unsafeUnwrap(),
    ).toEqual([
      { muscleGroup: "pecs", exerciseType: "machine", preferenceScore: 2 },
    ]);
  });
});
