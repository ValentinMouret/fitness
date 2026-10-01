import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";
import pg from "pg";
import { z } from "zod";
import {
  canWriteFixtureDatabase,
  fixtureOwnerId,
  verifyFixtureServerDatabase,
} from "../support/fixture-database";

const databaseUrl = process.env.E2E_DATABASE_URL;
test.skip(
  !canWriteFixtureDatabase(databaseUrl),
  "Requires dedicated native test server/database",
);
test.describe.configure({ mode: "serial" });
const pool = new pg.Pool({ connectionString: databaseUrl });
const other = randomUUID();
const otherEmail = `${other}@example.invalid`;
const ownWorkout = randomUUID();
const otherWorkout = randomUUID();
const exercise = randomUUID();
const createdWorkouts: string[] = [ownWorkout, otherWorkout];
let ownerEmail: string;
let ownerSessionIds: readonly string[] = [];
let previous: { time_zone: string; updated_at: Date } | undefined;

async function signIn(page: Page, email: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page
    .getByRole("button", { name: "Email me a sign-in link", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "If this email is invited",
  );
  const messages = (
    await readFile(
      z.string().min(1).parse(process.env.AUTH_LOCAL_INBOX),
      "utf8",
    )
  )
    .trim()
    .split("\n")
    .map((line) =>
      z.object({ to: z.string(), url: z.url() }).parse(JSON.parse(line)),
    );
  const message = messages.findLast((entry) => entry.to === email);
  if (!message) throw new Error("Native sign-in email missing");
  await page.goto(message.url);
  await page.getByRole("link", { name: "Open Fitness", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("Loading…", { exact: true })).toHaveCount(0);
}

test.beforeAll(async ({ browser }) => {
  const owner = fixtureOwnerId();
  const user = (
    await pool.query("select email from auth_users where id=$1", [owner])
  ).rows[0];
  ownerEmail = z.email().parse(user?.email);
  previous = (
    await pool.query(
      "select time_zone,updated_at from account_settings where user_id=$1",
      [owner],
    )
  ).rows[0];

  ownerSessionIds = (
    await pool.query("select id from auth_sessions where user_id=$1", [owner])
  ).rows.map((row) => row.id);
  const preflight = await browser.newContext({
    baseURL: process.env.E2E_BASE_URL,
    storageState: { cookies: [], origins: [] },
  });
  try {
    await signIn(await preflight.newPage(), ownerEmail);
    await verifyFixtureServerDatabase(preflight.request, pool);
  } finally {
    await preflight.close();
  }

  await pool.query(
    "insert into auth_users(id,name,email) values($1,'Native B fixture',$2)",
    [other, otherEmail],
  );
  await pool.query(
    "insert into auth_invitations(user_id,invited_by,expires_at,accepted_at) values($1,$2,now()+interval '1 day',now())",
    [other, owner],
  );
  await pool.query(
    "insert into exercises(id,name,type,movement_pattern) values($1,'Native shared test lift','barbell','push')",
    [exercise],
  );
  await pool.query(
    "insert into exercise_muscle_groups(exercise,muscle_group,split) values($1,'pecs',100)",
    [exercise],
  );
  await pool.query(
    "insert into exercise_preferences(user_id,exercise_id,description,mmc_instructions) values($1,$2,'Native A private description','Native A private cue')",
    [owner, exercise],
  );
  await pool.query(
    "insert into workouts(user_id,id,name,start,stop) values($1,$2,'Native A private session','1900-01-01','1900-01-01 01:00'),($3,$4,'Native B private session','1900-01-02','1900-01-02 01:00')",
    [owner, ownWorkout, other, otherWorkout],
  );
});

test.afterAll(async () => {
  await pool.query(
    "delete from habit_completions where habit_id in(select id from habits where user_id=$1)",
    [other],
  );
  await pool.query("delete from habits where user_id=$1", [other]);
  await pool.query("delete from daily_note where user_id=$1", [other]);
  await pool.query("delete from meal_log_ingredients where user_id=$1", [
    other,
  ]);
  await pool.query("delete from meal_logs where user_id=$1", [other]);
  await pool.query("delete from ingredients where user_id=$1", [other]);
  await pool.query("delete from targets where user_id=$1", [other]);
  await pool.query("delete from measures where user_id=$1", [other]);
  await pool.query("delete from measurements where user_id=$1", [other]);
  await pool.query("delete from workout_sets where workout=any($1::uuid[])", [
    createdWorkouts,
  ]);
  await pool.query(
    "delete from workout_exercises where workout_id=any($1::uuid[])",
    [createdWorkouts],
  );
  await pool.query("delete from workouts where id=any($1::uuid[])", [
    createdWorkouts,
  ]);
  await pool.query("delete from exercise_preferences where exercise_id=$1", [
    exercise,
  ]);
  await pool.query("delete from exercise_muscle_groups where exercise=$1", [
    exercise,
  ]);
  await pool.query("delete from exercises where id=$1", [exercise]);
  await pool.query(
    "delete from account_settings where user_id=any($1::uuid[])",
    [[other, fixtureOwnerId()]],
  );
  if (previous)
    await pool.query(
      "insert into account_settings(user_id,time_zone,updated_at) values($1,$2,$3)",
      [fixtureOwnerId(), previous.time_zone, previous.updated_at],
    );
  await pool.query("delete from auth_invitations where user_id=$1", [other]);
  await pool.query("delete from auth_users where id=$1", [other]);
  await pool.query(
    "delete from auth_sessions where user_id=$1 and not(id=any($2::uuid[]))",
    [fixtureOwnerId(), ownerSessionIds],
  );
  await pool.end();
});

test("native A and B retain separate histories and catalogue controls, and logout revokes access", async ({
  page,
  browser,
}) => {
  await signIn(page, ownerEmail);
  await verifyFixtureServerDatabase(page.request, pool);
  await page.goto("/workouts/exercises");
  await expect(
    page.getByRole("link", { name: "Add Exercise", exact: true }).first(),
  ).toBeVisible();
  const context = await browser.newContext({
    baseURL: process.env.E2E_BASE_URL,
    viewport: { width: 390, height: 844 },
    timezoneId: "America/Los_Angeles",
    storageState: { cookies: [], origins: [] },
  });
  try {
    const b = await context.newPage();
    await signIn(b, otherEmail);
    expect(
      (
        await pool.query("select name from measurements where user_id=$1", [
          other,
        ])
      ).rows,
    ).toEqual([]);
    const guard = `native_weight_${other.replaceAll("-", "")}`;
    await pool.query(
      `create function ${guard}() returns trigger language plpgsql as $$ begin if NEW.user_id='${other}' then raise exception 'Native test weight failure'; end if; return NEW; end $$`,
    );
    try {
      await pool.query(
        `create trigger ${guard} before insert on measures for each row execute function ${guard}()`,
      );
      try {
        expect(
          (
            await b.request.post("/dashboard", { form: { weight: "77.999" } })
          ).status(),
        ).toBe(500);
        expect(
          (
            await pool.query("select name from measurements where user_id=$1", [
              other,
            ])
          ).rows,
        ).toEqual([]);
      } finally {
        await pool.query(`drop trigger ${guard} on measures`);
      }
    } finally {
      await pool.query(`drop function ${guard}()`);
    }
    const renamed = `${guard}_definitions`;
    await pool.query(`alter table measurements rename to ${renamed}`);
    try {
      expect((await b.request.get("/dashboard")).status()).toBe(500);
    } finally {
      await pool.query(`alter table ${renamed} rename to measurements`);
    }
    await b.getByRole("textbox", { name: "Weight", exact: true }).fill("77.25");
    await b.getByRole("button", { name: "Log", exact: true }).click();
    await expect
      .poll(
        async () =>
          (
            await pool.query(
              "select value from measures where user_id=$1 and measurement_name='weight'",
              [other],
            )
          ).rows[0]?.value,
      )
      .toBe(77.25);
    await b.reload();
    await expect(
      b.getByRole("textbox", { name: "Weight", exact: true }),
    ).toHaveAttribute("placeholder", "77.25");
    expect(
      (
        await pool.query(
          "select name,unit from measurements where user_id=$1",
          [other],
        )
      ).rows,
    ).toEqual([{ name: "weight", unit: "kg" }]);
    expect(
      (
        await pool.query(
          "select time_zone from account_settings where user_id=$1",
          [other],
        )
      ).rows,
    ).toEqual([{ time_zone: "America/Los_Angeles" }]);
    await b.goto("/workouts/exercises");
    await expect(
      b.getByRole("link", { name: "Add Exercise", exact: true }),
    ).toHaveCount(0);
    await expect(
      b.getByRole("button", { name: "Edit exercise", exact: true }),
    ).toHaveCount(0);
    expect((await b.request.get("/workouts/exercises/create")).status()).toBe(
      403,
    );
    expect(
      (
        await b.request.post("/workouts/exercises/create", {
          form: { name: "Forbidden native B exercise" },
        })
      ).status(),
    ).toBe(403);
    await b.goto(`/workouts/${otherWorkout}`);
    await expect(
      b.getByRole("heading", { name: "Native B private session", exact: true }),
    ).toBeVisible();
    expect((await b.request.get(`/workouts/${ownWorkout}`)).status()).toBe(404);
    expect((await page.request.get(`/workouts/${otherWorkout}`)).status()).toBe(
      404,
    );
    await b.goto("/sign-in");
    await b.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(b.getByLabel("Email", { exact: true })).toBeVisible();
    await b.goto("/dashboard");
    await expect(b).toHaveURL(/\/sign-in$/);
  } finally {
    await context.close();
  }
});

test("native B saves and reloads private habits, measurements, notes, meals, targets and sets", async ({
  page,
  browser,
}) => {
  await signIn(page, otherEmail);
  const aContext = await browser.newContext({
    baseURL: process.env.E2E_BASE_URL,
    storageState: { cookies: [], origins: [] },
  });
  try {
    const a = await aContext.newPage();
    await signIn(a, ownerEmail);
    const post = (path: string, form: Readonly<Record<string, string>>) =>
      page.request.post(path, { form, maxRedirects: 0 });
    const habitName = `Native B habit ${other}`;
    expect(
      (
        await post("/habits/new", {
          name: habitName,
          freqMode: "daily",
          color: "#e15a46",
        })
      ).status(),
    ).toBe(302);
    const habit = (
      await pool.query("select id from habits where user_id=$1 and name=$2", [
        other,
        habitName,
      ])
    ).rows[0].id;
    expect(
      (
        await post("/habits", {
          intent: "toggle-completion",
          habitId: habit,
          completed: "true",
        })
      ).ok(),
    ).toBe(true);
    await page.goto("/habits");
    await expect(page.getByText(habitName, { exact: true })).toBeVisible();
    expect(
      (
        await a.request.post("/habits", {
          form: {
            intent: "toggle-completion",
            habitId: habit,
            completed: "false",
          },
        })
      ).status(),
    ).toBe(404);
    expect(await (await a.request.get("/habits")).text()).not.toContain(
      habitName,
    );
    const measureName = `native_b_${other.replaceAll("-", "")}`;
    expect(
      (
        await post("/measurements/new", { name: measureName, unit: "cm" })
      ).status(),
    ).toBe(302);
    await page.goto(`/measurements/${measureName}`);
    await page.getByLabel("Value (cm)", { exact: true }).fill("33.75");
    await page.getByLabel("Date", { exact: true }).fill("2020-05-06");
    await page
      .getByRole("button", { name: "Add Measurement", exact: true })
      .click();
    await expect
      .poll(
        async () =>
          (
            await pool.query(
              "select value from measures where user_id=$1 and measurement_name=$2",
              [other, measureName],
            )
          ).rows[0]?.value,
      )
      .toBe(33.75);
    await page.reload();
    await expect(
      page.getByRole("cell", { name: "33.75 cm", exact: true }),
    ).toBeVisible();
    expect((await a.request.get(`/measurements/${measureName}`)).status()).toBe(
      404,
    );
    expect(
      (
        await post("/dashboard", {
          intent: "save-note",
          content: "Native B private note",
        })
      ).ok(),
    ).toBe(true);
    expect(await (await a.request.get("/dashboard")).text()).not.toContain(
      "Native B private note",
    );
    const foodName = `Native B food ${other}`;
    expect(
      (
        await post("/nutrition/meal-builder", {
          intent: "save-ai-ingredient",
          ingredientData: JSON.stringify({
            name: foodName,
            category: "proteins",
            texture: "firm_solid",
            calories: 100,
            protein: 20,
            carbs: 5,
            fat: 2,
            fiber: 1,
            waterPercentage: 70,
            energyDensity: 1,
            sliderMin: 5,
            sliderMax: 500,
            isVegetarian: false,
            isVegan: false,
          }),
        })
      ).ok(),
    ).toBe(true);
    const food = (
      await pool.query(
        "select id from ingredients where user_id=$1 and name=$2",
        [other, foodName],
      )
    ).rows[0].id;
    expect(
      (
        await post("/nutrition/meal-builder", {
          intent: "save-meal",
          mode: "create",
          mealCategory: "lunch",
          loggedDate: "1900-01-03",
          ingredients: JSON.stringify([{ id: food, quantity: 100 }]),
        })
      ).status(),
    ).toBe(302);
    const meal = (
      await pool.query("select id from meal_logs where user_id=$1", [other])
    ).rows[0].id;
    await page.goto("/nutrition?date=1900-01-03");
    await expect(page.getByText(foodName, { exact: true })).toBeVisible();
    expect(
      (await a.request.get(`/nutrition/meal-builder?mealId=${meal}`)).status(),
    ).toBe(404);
    expect(
      (
        await post("/nutrition/calculate-targets", {
          age: "30",
          height: "180",
          weight: "75",
          activity: "1.5",
          delta: "0",
          gender: "male",
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await pool.query("select user_id from targets where user_id=$1", [
          other,
        ])
      ).rows.length,
    ).toBeGreaterThan(0);
    const created = await post("/workouts/create", {});
    expect(created.status()).toBe(302);
    const location = created.headers().location;
    const workout = z.uuid().parse(location.split("/").at(-1));
    createdWorkouts.push(workout);
    expect(
      (
        await post(location, { intent: "add-exercise", exerciseId: exercise })
      ).ok(),
    ).toBe(true);
    expect(
      (
        await post(location, {
          intent: "update-set",
          exerciseId: exercise,
          setNumber: "1",
          weight: "50",
          reps: "8",
          isCompleted: "true",
          reportedRir: "2",
        })
      ).ok(),
    ).toBe(true);
    expect(
      (
        await post(location, {
          intent: "update-exercise-mmc",
          exerciseId: exercise,
          mmcInstructions: "Native B private cue",
        })
      ).ok(),
    ).toBe(true);
    await page.goto(`${location}?exercise=${exercise}`);
    await expect(
      page.getByText("Native B private cue", { exact: true }),
    ).toBeVisible();
    expect(
      (
        await pool.query(
          'select weight,reps,"isCompleted",reported_rir from workout_sets where workout=$1 and set=1',
          [workout],
        )
      ).rows,
    ).toEqual([{ weight: 50, reps: 8, isCompleted: true, reported_rir: "2" }]);
    expect(
      (
        await a.request.post(location, {
          form: { intent: "update-name", name: "Foreign rename" },
        })
      ).status(),
    ).toBe(404);
    expect(
      await (await a.request.get("/workouts/exercises")).text(),
    ).not.toContain("Native B private cue");
    expect([200, 302]).toContain(
      (await post(location, { intent: "complete-workout" })).status(),
    );
    const history = z
      .object({ sessions: z.array(z.object({ workoutId: z.string() })) })
      .parse(
        await (
          await page.request.get(
            `/api/exercises/history?exerciseId=${exercise}`,
          )
        ).json(),
      );
    expect(history.sessions.map((session) => session.workoutId)).toEqual([
      workout,
    ]);
    const aHistory = z
      .object({ sessions: z.array(z.unknown()) })
      .parse(
        await (
          await a.request.get(`/api/exercises/history?exerciseId=${exercise}`)
        ).json(),
      );
    expect(aHistory.sessions).toEqual([]);
    const resolved = await post("/api/nutrition/estimate-meal", {
      intent: "resolve",
      mealCategory: "lunch",
      items: JSON.stringify([
        {
          name: foodName,
          estimatedGrams: 100,
          category: "proteins",
          texture: "firm_solid",
          calories: 100,
          protein: 20,
          carbs: 5,
          fat: 2,
          fiber: 1,
          waterPercentage: 70,
          energyDensity: 1,
          isVegetarian: false,
          isVegan: false,
        },
      ]),
    });
    expect(resolved.ok()).toBe(true);
    expect(
      z
        .object({
          ingredients: z.array(z.object({ ingredientId: z.string() })),
        })
        .parse(await resolved.json())
        .ingredients.map((item) => item.ingredientId),
    ).toEqual([food]);
    for (const path of [
      "/dashboard.data",
      "/habits.data",
      "/nutrition.data",
      `/measurements/${measureName}.data`,
    ]) {
      const response = await a.request.get(path);
      const body = await response.text();
      expect(body).not.toContain(habitName);
      expect(body).not.toContain(foodName);
    }
    expect(
      (
        await page.request.post("/api/nutrition/estimate-meal", {
          headers: { Origin: "https://untrusted.invalid" },
          form: { intent: "resolve", mealCategory: "lunch", items: "[]" },
        })
      ).status(),
    ).toBe(403);
  } finally {
    await aContext.close();
  }
});
