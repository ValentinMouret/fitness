import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import pg from "pg";
import { dateInTimeZone, toDateString } from "../../app/time";
import {
  canWriteFixtureDatabase,
  fixtureOwnerId,
  verifyFixtureServerDatabase,
} from "./support/fixture-database";

const databaseUrl = process.env.E2E_DATABASE_URL;
test.skip(
  !canWriteFixtureDatabase(databaseUrl),
  "Requires matching dedicated test database",
);
test.describe.configure({ mode: "serial" });
test.use({
  viewport: { width: 390, height: 844 },
  timezoneId: "Pacific/Auckland",
});

test("device timezone persists before calendar interaction and rejects forged account input", async ({
  page,
}) => {
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const owner = fixtureOwnerId();
  const previous = (
    await pool.query("select * from account_settings where user_id=$1", [owner])
  ).rows[0];
  try {
    await verifyFixtureServerDatabase(page.request, pool);
    await pool.query(
      "insert into account_settings(user_id,time_zone) values($1,'UTC') on conflict(user_id) do update set time_zone='UTC'",
      [owner],
    );
    await page.goto("/nutrition");
    await expect(
      page.getByRole("heading", { name: "Today", exact: true }),
    ).toBeVisible();
    await expect
      .poll(
        async () =>
          (
            await pool.query(
              "select time_zone from account_settings where user_id=$1",
              [owner],
            )
          ).rows[0]?.time_zone,
      )
      .toBe("Pacific/Auckland");
    const expectedDate = toDateString(
      dateInTimeZone(new Date(), "Pacific/Auckland"),
    );
    await expect(
      page.getByRole("link", { name: "Add Breakfast", exact: true }),
    ).toHaveAttribute("href", new RegExp(`date=${expectedDate}`));
    const invalid = await page.request.post("/account/timezone", {
      form: { timeZone: "not/a-zone" },
    });
    expect(invalid.status()).toBe(400);
    const forged = await page.request.post("/account/timezone", {
      form: { timeZone: "UTC", userId: randomUUID() },
    });
    expect(forged.status()).toBe(400);
    expect(
      (
        await pool.query(
          "select time_zone from account_settings where user_id=$1",
          [owner],
        )
      ).rows[0].time_zone,
    ).toBe("Pacific/Auckland");
    const crossOrigin = await page.request.post("/account/timezone", {
      headers: { Origin: "https://untrusted.invalid" },
      form: { timeZone: "UTC" },
    });
    expect(crossOrigin.status()).toBe(403);
  } finally {
    await pool.query("delete from account_settings where user_id=$1", [owner]);
    if (previous)
      await pool.query(
        "insert into account_settings(user_id,time_zone,updated_at) values($1,$2,$3)",
        [owner, previous.time_zone, previous.updated_at],
      );
    await pool.end();
  }
});

test("revalidation keeps unsaved completed-set and measurement edits mounted", async ({
  page,
}) => {
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const owner = fixtureOwnerId();
  const workout = randomUUID();
  const exercise = randomUUID();
  const measurement = `timezone_${randomUUID().replaceAll("-", "")}`;
  const previous = (
    await pool.query("select * from account_settings where user_id=$1", [owner])
  ).rows[0];
  try {
    await verifyFixtureServerDatabase(page.request, pool);
    await pool.query(
      "insert into exercises(id,name,type,movement_pattern) values($1,'Timezone draft lift','barbell','push')",
      [exercise],
    );
    await pool.query(
      "insert into workouts(id,user_id,name,start) values($1,$2,'Timezone draft workout',now())",
      [workout, owner],
    );
    await pool.query(
      "insert into workout_exercises(workout_id,exercise_id,order_index) values($1,$2,0)",
      [workout, exercise],
    );
    await pool.query(
      'insert into workout_sets(workout,exercise,set,reps,weight,"isCompleted") values($1,$2,1,8,60,true),($1,$2,2,null,null,false)',
      [workout, exercise],
    );
    await pool.query(
      "insert into measurements(user_id,name,unit) values($1,$2,'kg')",
      [owner, measurement],
    );
    await pool.query(
      "insert into measures(user_id,measurement_name,value,t) values($1,$2,10,'1900-01-01')",
      [owner, measurement],
    );
    await page.goto(`/workouts/${workout}?exercise=${exercise}`);
    await page.getByRole("button", { name: "Edit set 1", exact: true }).click();
    await page
      .getByRole("textbox", { name: "Set 1 weight", exact: true })
      .fill("81.75");
    await pool.query(
      "update account_settings set time_zone='America/Los_Angeles' where user_id=$1",
      [owner],
    );
    await page
      .getByRole("textbox", { name: "Set 2 weight", exact: true })
      .fill("44");
    await expect
      .poll(
        async () =>
          (
            await pool.query(
              "select weight from workout_sets where workout=$1 and set=2",
              [workout],
            )
          ).rows[0]?.weight,
      )
      .toBe(44);
    await expect(
      page.getByRole("textbox", { name: "Set 1 weight", exact: true }),
    ).toHaveValue("81.75");
    expect(
      (
        await pool.query(
          "select weight from workout_sets where workout=$1 and set=1",
          [workout],
        )
      ).rows[0].weight,
    ).toBe(60);
    await page.goto(`/measurements/${measurement}`);
    await page.getByLabel("Value (kg)", { exact: true }).fill("88.5");
    await page.getByLabel("Date", { exact: true }).fill("2020-05-06");
    await page
      .getByRole("button", { name: "Delete measurement", exact: true })
      .click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(
      page.getByText(
        "No measurements recorded yet. Add your first measurement above.",
      ),
    ).toBeVisible();
    await expect(page.getByLabel("Value (kg)", { exact: true })).toHaveValue(
      "88.5",
    );
    await expect(page.getByLabel("Date", { exact: true })).toHaveValue(
      "2020-05-06",
    );
    await page
      .getByRole("button", { name: "Add Measurement", exact: true })
      .click();
    await expect
      .poll(async () =>
        (
          await pool.query(
            "select t from measures where user_id=$1 and measurement_name=$2",
            [owner, measurement],
          )
        ).rows[0]?.t.toISOString(),
      )
      .toBe("2020-05-06T00:00:00.000Z");
  } finally {
    await pool.query("delete from workout_sets where workout=$1", [workout]);
    await pool.query("delete from workout_exercises where workout_id=$1", [
      workout,
    ]);
    await pool.query("delete from workouts where id=$1", [workout]);
    await pool.query("delete from exercises where id=$1", [exercise]);
    await pool.query(
      "delete from measures where user_id=$1 and measurement_name=$2",
      [owner, measurement],
    );
    await pool.query("delete from measurements where user_id=$1 and name=$2", [
      owner,
      measurement,
    ]);
    await pool.query("delete from account_settings where user_id=$1", [owner]);
    if (previous)
      await pool.query(
        "insert into account_settings(user_id,time_zone,updated_at) values($1,$2,$3)",
        [owner, previous.time_zone, previous.updated_at],
      );
    await pool.end();
  }
});

test("western device timezone retains explicit meal calendar dates", async ({
  browser,
  page,
}) => {
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const owner = fixtureOwnerId();
  const previous = (
    await pool.query("select * from account_settings where user_id=$1", [owner])
  ).rows[0];
  const context = await browser.newContext({
    storageState: await page.context().storageState(),
    timezoneId: "America/Los_Angeles",
    viewport: { width: 390, height: 844 },
  });
  try {
    const western = await context.newPage();
    await western.goto(
      "/nutrition/meal-builder?meal=breakfast&date=2026-10-01",
    );
    await expect(
      western.getByRole("heading", {
        name: "Add Breakfast for Thursday, Oct 1",
        exact: true,
      }),
    ).toBeVisible();
    await expect
      .poll(
        async () =>
          (
            await pool.query(
              "select time_zone from account_settings where user_id=$1",
              [owner],
            )
          ).rows[0]?.time_zone,
      )
      .toBe("America/Los_Angeles");
  } finally {
    await context.close();
    await pool.query("delete from account_settings where user_id=$1", [owner]);
    if (previous)
      await pool.query(
        "insert into account_settings(user_id,time_zone,updated_at) values($1,$2,$3)",
        [owner, previous.time_zone, previous.updated_at],
      );
    await pool.end();
  }
});

test("direct date-default writes require timezone and repeated weight logs keep actual instants", async ({
  page,
}) => {
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const owner = fixtureOwnerId();
  const previous = (
    await pool.query("select * from account_settings where user_id=$1", [owner])
  ).rows[0];
  const start = new Date();
  const createdTimestamps: Date[] = [];
  const definition = (
    await pool.query(
      "select name from measurements where user_id=$1 and name='weight'",
      [owner],
    )
  ).rows[0];
  try {
    await verifyFixtureServerDatabase(page.request, pool);
    await pool.query("delete from account_settings where user_id=$1", [owner]);
    const before = (
      await pool.query(
        "select c.* from habit_completions c join habits h on h.id=c.habit_id where h.user_id=$1",
        [owner],
      )
    ).rows;
    const denied = await page.request.post("/habits", {
      form: {
        intent: "toggle-completion",
        habitId: randomUUID(),
        completed: "true",
      },
    });
    expect(denied.status()).toBe(409);
    expect(
      (
        await pool.query(
          "select c.* from habit_completions c join habits h on h.id=c.habit_id where h.user_id=$1",
          [owner],
        )
      ).rows,
    ).toEqual(before);
    await page.goto("/nutrition");
    await expect(
      page.getByRole("heading", { name: "Today", exact: true }),
    ).toBeVisible();
    if (!definition)
      await pool.query(
        "insert into measurements(user_id,name,unit) values($1,'weight','kg')",
        [owner],
      );
    for (const weight of [78.123, 78.456]) {
      const response = await page.request.post("/dashboard", {
        form: { weight: String(weight) },
      });
      const saved = (
        await pool.query(
          "select t from measures where user_id=$1 and measurement_name='weight' and t >= $2 and value=$3",
          [owner, start, weight],
        )
      ).rows;
      createdTimestamps.push(...saved.map((row) => row.t));
      expect(response.ok()).toBe(true);
    }
    const rows = (
      await pool.query(
        "select value,t from measures where user_id=$1 and measurement_name='weight' and t >= $2 order by t",
        [owner, start],
      )
    ).rows;
    expect(rows.map((row) => row.value)).toEqual([78.123, 78.456]);
    expect(rows[0].t.getTime()).toBeGreaterThanOrEqual(start.getTime());
    expect(rows[1].t.getTime()).toBeGreaterThan(rows[0].t.getTime());
  } finally {
    await pool.query(
      "delete from measures where user_id=$1 and measurement_name='weight' and t = any($2::timestamptz[])",
      [owner, createdTimestamps],
    );
    if (!definition)
      await pool.query(
        "delete from measurements where user_id=$1 and name='weight'",
        [owner],
      );
    await pool.query("delete from account_settings where user_id=$1", [owner]);
    if (previous)
      await pool.query(
        "insert into account_settings(user_id,time_zone,updated_at) values($1,$2,$3)",
        [owner, previous.time_zone, previous.updated_at],
      );
    await pool.end();
  }
});
