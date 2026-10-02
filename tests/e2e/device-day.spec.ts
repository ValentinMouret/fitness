import { randomUUID } from "node:crypto";
import { test as base, expect } from "@playwright/test";
import pg from "pg";
import {
  canWriteFixtureDatabase,
  verifyFixtureServerDatabase,
} from "./support/fixture-database";

const test = base.extend<{
  readonly dayFixture: {
    readonly pool: pg.Pool;
    readonly ids: readonly string[];
    readonly names: readonly string[];
  };
}>({
  dayFixture: async ({ request }, use) => {
    const pool = new pg.Pool({
      connectionString: process.env.E2E_DATABASE_URL,
    });
    const ids = [randomUUID(), randomUUID(), randomUUID()];
    const names = ids.map(
      (id, index) =>
        `${["Friday", "Saturday", "Daily"][index]} day fixture ${id}`,
    );
    try {
      await verifyFixtureServerDatabase(request, pool);
      for (const [index, id] of ids.entries()) {
        await pool.query(
          "insert into habits (id, name, frequency_type, frequency_config, start_date, is_active) values ($1, $2, $3, $4, '1900-01-01', true)",
          [
            id,
            names[index],
            index === 2 ? "daily" : "weekly",
            JSON.stringify(
              index === 2
                ? {}
                : { days_of_week: [index === 0 ? "Friday" : "Saturday"] },
            ),
          ],
        );
      }
      await pool.query(
        "insert into habit_completions (habit_id, completion_date, completed, notes) values ($1, '2030-01-04', true, 'Historical Friday')",
        [ids[2]],
      );
      await use({ pool, ids, names });
    } finally {
      await pool.query(
        "delete from habit_completions where habit_id = any($1::uuid[])",
        [ids],
      );
      await pool.query("delete from habits where id = any($1::uuid[])", [ids]);
      await pool.end();
    }
  },
});

test.skip(
  !canWriteFixtureDatabase(process.env.E2E_DATABASE_URL),
  "Requires a matching dedicated test database/server",
);
test.use({ timezoneId: "Europe/Paris", viewport: { width: 390, height: 844 } });

test("Saturday on the device selects Saturday habits on both pages and saves that day", async ({
  page,
  dayFixture,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.clock.setFixedTime(new Date("2030-01-04T23:30:00Z"));
  for (const path of ["/habits", "/dashboard"]) {
    await page.goto(path);
    await expect(
      page.getByText(dayFixture.names[1], { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(dayFixture.names[0], { exact: true }),
    ).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`${path}\\?day=2030-01-05$`));
    const button = page.getByRole("button", {
      name: new RegExp(`Mark.*${dayFixture.names[2]}.*completed`),
    });
    if (path === "/dashboard") {
      await expect(
        page.getByRole("button", {
          name: new RegExp(`Unmark.*${dayFixture.names[2]}`),
        }),
      ).toBeVisible();
      await page
        .getByRole("button", {
          name: new RegExp(`Unmark.*${dayFixture.names[2]}`),
        })
        .click();
      await expect(button).toBeVisible();
    }
    await button.click();
    await expect(
      page.getByRole("button", {
        name: new RegExp(`Unmark.*${dayFixture.names[2]}`),
      }),
    ).toBeVisible();
    await expect
      .poll(
        async () =>
          (
            await dayFixture.pool.query(
              "select completed from habit_completions where habit_id=$1 and completion_date='2030-01-05'",
              [dayFixture.ids[2]],
            )
          ).rows[0]?.completed,
      )
      .toBe(true);
    await page.reload();
    await expect(
      page.getByRole("button", {
        name: new RegExp(`Unmark.*${dayFixture.names[2]}`),
      }),
    ).toBeVisible();
  }
  expect(
    (
      await dayFixture.pool.query(
        "select completed, notes from habit_completions where habit_id=$1 and completion_date='2030-01-04'",
        [dayFixture.ids[2]],
      )
    ).rows,
  ).toEqual([{ completed: true, notes: "Historical Friday" }]);
  expect(errors).toEqual([]);
});

for (const path of ["/habits", "/dashboard"]) {
  test(`${path} changes day across device midnight and on return to the page`, async ({
    page,
    dayFixture,
  }) => {
    await page.clock.install({ time: new Date("2030-01-04T22:59:59Z") });
    await page.clock.pauseAt(new Date("2030-01-04T22:59:59Z"));
    await page.goto(path);
    await expect(
      page.getByText(dayFixture.names[0], { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: new RegExp(`Unmark.*${dayFixture.names[2]}`),
      }),
    ).toBeVisible();
    await page.clock.fastForward(2_000);
    await expect(
      page.getByText(dayFixture.names[1], { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(dayFixture.names[0], { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", {
        name: new RegExp(`Mark.*${dayFixture.names[2]}`),
      }),
    ).toBeVisible();
    await page.goto("/workouts");
    await page
      .getByRole("link", {
        name: path === "/habits" ? "Habits" : "Dashboard",
        exact: true,
      })
      .click();
    await expect(
      page.getByText(dayFixture.names[1], { exact: true }),
    ).toBeVisible();
    await page.clock.setSystemTime(new Date("2030-01-05T23:30:00Z"));
    await expect(page).toHaveURL(new RegExp(`${path}\\?day=2030-01-05$`));
    await page.evaluate(() => window.dispatchEvent(new Event("pageshow")));
    await expect(page).toHaveURL(new RegExp(`${path}\\?day=2030-01-06$`));
    await expect(
      page.getByText(dayFixture.names[1], { exact: true }),
    ).toHaveCount(0);
  });
}

test.describe("device west of UTC", () => {
  test.use({ timezoneId: "America/Los_Angeles" });
  test("date-only Friday remains Friday on both pages", async ({
    page,
    dayFixture,
  }) => {
    await page.clock.setFixedTime(new Date("2030-01-05T00:30:00Z"));
    for (const path of ["/habits", "/dashboard"]) {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`${path}\\?day=2030-01-04$`));
      await expect(
        page.getByText(dayFixture.names[0], { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText(dayFixture.names[1], { exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("button", {
          name: new RegExp(`Unmark.*${dayFixture.names[2]}`),
        }),
      ).toBeVisible();
    }
  });
});
