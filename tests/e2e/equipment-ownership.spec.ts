import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import pg from "pg";
import {
  canWriteFixtureDatabase,
  fixtureOwnerId,
  verifyFixtureServerDatabase,
} from "./support/fixture-database";

test.skip(
  !canWriteFixtureDatabase(process.env.E2E_DATABASE_URL),
  "Requires matching dedicated fixture database and server",
);
test.use({ viewport: { width: 390, height: 844 } });
test("substitute equipment shows only the actor's gym and rejects a foreign selection", async ({
  page,
  request,
}) => {
  const pool = new pg.Pool({ connectionString: process.env.E2E_DATABASE_URL });
  const other = randomUUID();
  const floors = [randomUUID(), randomUUID()];
  const equipment = [randomUUID(), randomUUID()];
  const exercise = randomUUID();
  const workout = randomUUID();
  const ownName = `Owned machine ${randomUUID()}`;
  const foreignName = `Private other machine ${randomUUID()}`;
  const path = `/workouts/${workout}/substitute/${exercise}`;
  const before = async () =>
    (
      await pool.query(
        "select to_jsonb(e) as equipment from equipment_instances e where id=any($1::uuid[]) order by id",
        [equipment],
      )
    ).rows;
  try {
    await verifyFixtureServerDatabase(request, pool);
    await pool.query(
      "insert into auth_users (id,name,email) values ($1,'Other equipment fixture',$2)",
      [other, `${other}@example.invalid`],
    );
    for (const [index, actor] of [fixtureOwnerId(), other].entries()) {
      await pool.query(
        "insert into gym_floors (user_id,id,name,floor_number) values ($1,$2,$3,1987)",
        [
          actor,
          floors[index],
          index ? "Other private floor" : "Own fixture floor",
        ],
      );
      await pool.query(
        "insert into equipment_instances (user_id,id,name,exercise_type,gym_floor_id) values ($1,$2,$3,'machine',$4)",
        [actor, equipment[index], index ? foreignName : ownName, floors[index]],
      );
    }
    await pool.query(
      "insert into exercises (id,name,type,movement_pattern) values ($1,$2,'machine','push')",
      [exercise, `Neutral fixture ${exercise}`],
    );
    await pool.query(
      "insert into workouts (user_id,id,name,start) values ($1,$2,'Equipment fixture','1905-01-01')",
      [fixtureOwnerId(), workout],
    );
    await pool.query(
      "insert into workout_exercises (workout_id,exercise_id,order_index) values ($1,$2,0)",
      [workout, exercise],
    );
    const original = await before();
    await page.goto(path);
    await expect(
      page.getByRole("checkbox", { name: `${ownName} (machine)` }),
    ).toBeChecked();
    await expect(page.getByText(foreignName, { exact: true })).toHaveCount(0);
    const response = await request.post(path, {
      form: { equipment: equipment[1] },
    });
    expect(response.status()).toBe(404);
    expect(await response.text()).not.toContain(foreignName);
    expect(await before()).toEqual(original);
    const data = await request.get(
      `/workouts/${workout}/substitute/${exercise}.data`,
    );
    expect(data.ok()).toBe(true);
    expect(await data.text()).toContain(ownName);
    expect(await data.text()).not.toContain(foreignName);
  } finally {
    await pool.query("delete from workout_exercises where workout_id=$1", [
      workout,
    ]);
    await pool.query("delete from workouts where id=$1", [workout]);
    await pool.query("delete from exercises where id=$1", [exercise]);
    await pool.query(
      "delete from equipment_instances where id=any($1::uuid[])",
      [equipment],
    );
    await pool.query("delete from gym_floors where id=any($1::uuid[])", [
      floors,
    ]);
    await pool.query("delete from auth_users where id=$1", [other]);
    await pool.end();
  }
});
