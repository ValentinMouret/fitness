import { randomUUID } from "node:crypto";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { expect, it } from "vitest";
import { z } from "zod";
import { bootstrapAuthOwner } from "../../app/modules/auth/infra/owner-bootstrap.server";
import { createDisposablePostgres } from "./support/disposable-postgres";

it("rehearses the complete held ownership stack against one mixed legacy owner dataset", async () => {
  const fixture = createDisposablePostgres(
    new URL(z.url().parse(process.env.TENANT_TEST_ADMIN_URL)),
  );
  const { pool, database } = fixture;
  const owner = randomUUID();
  const habit = randomUUID();
  const exercise = randomUUID();
  const workout = randomUUID();
  const template = randomUUID();
  const food = randomUUID();
  const recipe = randomUUID();
  const meal = randomUUID();
  const floor = randomUUID();
  const connection = randomUUID();
  const owned = [
    "habits",
    "measurements",
    "measures",
    "targets",
    "daily_note",
    "oauth_connections",
    "workouts",
    "workout_templates",
    "ingredients",
    "meal_templates",
    "meal_logs",
    "meal_template_ingredients",
    "meal_log_ingredients",
    "gym_floors",
    "equipment_instances",
    "equipment_preferences",
    "training_preferences",
    "generation_conversations",
  ];
  const children = [
    "habit_completions",
    "oauth_authorization_codes",
    "oauth_tokens",
    "workout_exercises",
    "workout_sets",
    "workout_template_exercises",
    "workout_template_sets",
  ];
  const tables = [...owned, ...children];
  const read = () =>
    Promise.all(
      tables.map(async (table) =>
        (
          await pool.query(
            `select to_jsonb(legacy_row) as record from ${table} legacy_row`,
          )
        ).rows.map((row) =>
          z.record(z.string(), z.unknown()).parse(row.record),
        ),
      ),
    );
  try {
    await fixture.create();
    await fixture.migrateBefore(13);
    await pool.query(
      "insert into habits (id,name,description,start_date,frequency_type,target_count,is_active,deleted_at) values ($1,'Legacy habit','Retained note','1900-01-01','daily',1,false,'1900-01-02')",
      [habit],
    );
    await pool.query(
      "insert into habit_completions (habit_id,completion_date,completed) values ($1,'1900-01-01',true)",
      [habit],
    );
    await pool.query(
      "insert into measurements (name,unit,description) values ('weight','kg','Retained definition')",
    );
    await pool.query(
      "insert into measures (measurement_name,t,value) values ('weight','1900-01-01',80)",
    );
    await pool.query(
      "insert into targets (measurement_name,value) values ('weight',78)",
    );
    await pool.query(
      "insert into daily_note (id,content) values (1,'Retained daily note')",
    );
    await pool.query(
      "insert into oauth_connections (id,client_id,resource,scope,revoked_at) values ($1,'legacy-fixture','https://example.invalid/mcp','fitness','1900-01-02')",
      [connection],
    );
    await pool.query(
      "insert into oauth_authorization_codes (hash,connection_id,redirect_uri,challenge,expires_at,consumed_at) values ('synthetic-code',$1,'https://example.invalid/callback','synthetic-challenge','1900-01-01','1900-01-02')",
      [connection],
    );
    await pool.query(
      "insert into oauth_tokens (access_hash,refresh_hash,connection_id,access_expires_at,refresh_expires_at,rotated_at) values ('synthetic-access','synthetic-refresh',$1,'1900-01-01','1900-01-02','1900-01-02')",
      [connection],
    );
    await pool.query(
      "insert into exercises (id,name,type,movement_pattern) values ($1,'Neutral legacy fixture','barbell','push')",
      [exercise],
    );
    await pool.query(
      "insert into workouts (id,name,start,stop,notes,imported_from_strong,deleted_at) values ($1,'Legacy workout','1900-01-01 10:00:00','1900-01-01 11:00:00','Retained workout note',true,'1900-01-02')",
      [workout],
    );
    await pool.query(
      "insert into workout_templates (id,name,source_workout_id) values ($1,'Legacy template',$2)",
      [template, workout],
    );
    await pool.query("update workouts set template_id=$1 where id=$2", [
      template,
      workout,
    ]);
    await pool.query(
      "insert into workout_exercises (workout_id,exercise_id,order_index,notes) values ($1,$2,0,'Retained exercise note')",
      [workout, exercise],
    );
    await pool.query(
      "insert into workout_sets (workout,exercise,set,reps,weight,rpe,reported_rir,\"isCompleted\",note) values ($1,$2,1,8,60,8,'2',true,'Retained set note')",
      [workout, exercise],
    );
    await pool.query(
      "insert into workout_template_exercises (template_id,exercise_id,order_index) values ($1,$2,0)",
      [template, exercise],
    );
    await pool.query(
      "insert into workout_template_sets (template_id,exercise_id,set,target_reps,weight) values ($1,$2,1,8,60)",
      [template, exercise],
    );
    await pool.query(
      "insert into ingredients (id,name,category,calories,protein,carbs,fat,fiber,water_percentage,energy_density,texture,slider_min,slider_max) values ($1,'Legacy food','proteins',100,20,5,2,1,70,1,'firm_solid',5,500)",
      [food],
    );
    await pool.query(
      "insert into meal_templates (id,name,categories,total_calories,total_protein,total_carbs,total_fat,total_fiber,satiety_score,is_public,notes) values ($1,'Legacy public recipe',array['lunch','dinner']::meal_category[],100,20,5,2,1,3,true,'Retained recipe note')",
      [recipe],
    );
    await pool.query(
      "insert into meal_template_ingredients (meal_template_id,ingredient_id,quantity_grams) values ($1,$2,123)",
      [recipe, food],
    );
    await pool.query(
      "insert into meal_logs (id,meal_category,logged_date,meal_template_id,notes) values ($1,'lunch','1900-01-01',$2,'Retained consumed meal')",
      [meal, recipe],
    );
    await pool.query(
      "insert into meal_log_ingredients (meal_log_id,ingredient_id,quantity_grams) values ($1,$2,234)",
      [meal, food],
    );
    await pool.query(
      "insert into gym_floors (id,name,floor_number,description) values ($1,'Legacy gym',1,'Retained gym note')",
      [floor],
    );
    await pool.query(
      "insert into equipment_instances (name,exercise_type,gym_floor_id) values ('Legacy equipment','machine',$1)",
      [floor],
    );
    await pool.query(
      "insert into equipment_preferences (muscle_group,exercise_type,preference_score) values ('pecs','machine',8)",
    );
    await pool.query(
      "insert into training_preferences (content,deleted_at) values ('Retained private preference','1900-01-02')",
    );
    await pool.query(
      'insert into generation_conversations (workout_id,model,messages,context_snapshot,total_tokens,deleted_at) values ($1,\'retired-fixture\',\'[{"role":"user","content":"Retained conversation"}]\',\'{"note":"Retained private context"}\',123,\'1900-01-02\')',
      [workout],
    );
    const before = await read();
    await expect(
      migrate(database, { migrationsFolder: "./drizzle" }),
    ).rejects.toThrow();
    expect(await read()).toEqual(before);
    expect(
      (
        await bootstrapAuthOwner({
          pool,
          id: owner,
          email: `${owner}@example.invalid`,
          now: new Date(),
        })
      ).isOk(),
    ).toBe(true);
    await migrate(database, { migrationsFolder: "./drizzle" });
    expect(await read()).toEqual(
      before.map((rows, index) =>
        rows.map((row) =>
          index < owned.length ? { ...row, user_id: owner } : row,
        ),
      ),
    );
    expect(
      (
        await pool.query(
          "select count(*)::int as migrations from drizzle.__drizzle_migrations",
        )
      ).rows[0].migrations,
    ).toBe(21);
  } finally {
    await fixture.close();
  }
}, 30000);
