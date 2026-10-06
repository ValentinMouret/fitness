import { randomUUID } from "node:crypto";
import { test as base, expect } from "@playwright/test";
import pg from "pg";
import {
  canWriteFixtureDatabase,
  fixtureOwnerId,
  verifyFixtureServerDatabase,
} from "./support/fixture-database";

const starts = ["2100-06-01T23:30:00.000Z", "2100-05-28T08:30:00.000Z"];
const test = base.extend<{ readonly workoutIds: readonly string[] }>({
  workoutIds: async ({ request }, use) => {
    const pool = new pg.Pool({
      connectionString: process.env.E2E_DATABASE_URL,
    });
    const ids = starts.map(() => randomUUID());
    try {
      await verifyFixtureServerDatabase(request, pool);
      for (const [index, id] of ids.entries()) {
        await pool.query(
          "insert into workouts (user_id,id, name, start, stop) values ($4,$1, $2, $3, $3)",
          [id, `Timezone fixture ${id}`, starts[index], fixtureOwnerId()],
        );
      }
      await use(ids);
    } finally {
      await pool.query("delete from workouts where id = any($1::uuid[])", [
        ids,
      ]);
      await pool.end();
    }
  },
});

test.skip(
  !canWriteFixtureDatabase(process.env.E2E_DATABASE_URL),
  "Requires a matching dedicated fixture database/server",
);

for (const scenario of [
  {
    timezoneId: "Europe/Paris",
    labels: ["Today · 1:30 AM", "May 28 · 10:30 AM"],
  },
  {
    timezoneId: "America/Los_Angeles",
    labels: ["Today · 4:30 PM", "May 28 · 1:30 AM"],
  },
  { timezoneId: "UTC", labels: ["Yesterday · 11:30 PM", "May 28 · 8:30 AM"] },
]) {
  test.describe(scenario.timezoneId, () => {
    test.use({
      timezoneId: scenario.timezoneId,
      viewport: { width: 390, height: 844 },
    });
    test("hydrates dates without errors and preserves device-local days", async ({
      page,
      workoutIds,
    }) => {
      const errors: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      page.on("pageerror", (error) => errors.push(error.message));
      await page.clock.setFixedTime(new Date("2100-06-02T00:30:00.000Z"));
      const assertLabels = async () => {
        for (const [index, id] of workoutIds.entries()) {
          await expect(
            page
              .locator(`a[href="/workouts/${id}"]`)
              .getByText(scenario.labels[index], { exact: true }),
          ).toBeVisible();
        }
      };
      await page.goto("/workouts");
      await assertLabels();
      await page.reload();
      await assertLabels();
      await page.getByRole("link", { name: "Manage Exercises" }).click();
      await expect(page).toHaveURL(/\/workouts\/exercises$/);
      await page.getByRole("link", { name: "Workouts", exact: true }).click();
      await expect(page).toHaveURL(/\/workouts$/);
      await assertLabels();
      expect(errors).toEqual([]);
    });
  });
}
