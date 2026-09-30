import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import pg from "pg";
import {
  canWriteFixtureDatabase,
  verifyFixtureServerDatabase,
} from "./support/fixture-database";

test.use({ viewport: { width: 390, height: 844 } });
test.skip(
  !canWriteFixtureDatabase(process.env.E2E_DATABASE_URL),
  "Requires a matching dedicated fixture database and server",
);

test("orders today's habits by time and keeps manual, minimum and backfill completion independent", async ({
  page,
  request,
}) => {
  const pool = new pg.Pool({ connectionString: process.env.E2E_DATABASE_URL });
  const prefix = `Ordering ${randomUUID()}`;
  const definitions = [
    {
      id: randomUUID(),
      name: `${prefix} Z early`,
      time: "06:30",
      keystone: false,
    },
    {
      id: randomUUID(),
      name: `${prefix} A keystone`,
      time: "08:00",
      keystone: true,
    },
    {
      id: randomUUID(),
      name: `${prefix} B equal time`,
      time: "08:00",
      keystone: false,
    },
    {
      id: randomUUID(),
      name: `${prefix} D noon`,
      time: "12:00",
      keystone: false,
    },
    {
      id: randomUUID(),
      name: `${prefix} C evening`,
      time: "20:00",
      keystone: true,
    },
    { id: randomUUID(), name: `${prefix} F untimed`, time: "", keystone: true },
    {
      id: randomUUID(),
      name: `${prefix} E invalid`,
      time: "noon",
      keystone: false,
    },
  ];
  const ids = definitions.map((habit) => habit.id);
  try {
    await verifyFixtureServerDatabase(request, pool);
    for (const habit of definitions) {
      await pool.query(
        "insert into habits (id, name, time_of_day, is_keystone, minimal_version, frequency_type, start_date) values ($1, $2, $3, $4, 'One minute', 'daily', '2020-01-01')",
        [habit.id, habit.name, habit.time, habit.keystone],
      );
    }
    await page.goto("/habits");
    const morning = page.getByRole("region", { name: "Morning", exact: true });
    const later = page.getByRole("region", {
      name: "Later today",
      exact: true,
    });
    const anytime = page.getByRole("region", { name: "Anytime", exact: true });
    const orderedNames = async () => {
      for (const [section, indices] of [
        [morning, [0, 1, 2]],
        [later, [3, 4]],
        [anytime, [6, 5]],
      ] as const) {
        await expect(
          section.locator(".habit-card-a").filter({ hasText: prefix }),
        ).toHaveCount(indices.length);
        for (const [position, index] of indices.entries()) {
          await expect(
            section
              .locator(".habit-card-a")
              .filter({ hasText: prefix })
              .nth(position),
          ).toContainText(definitions[index].name);
        }
      }
    };
    await orderedNames();
    const card = (index: number) =>
      page
        .locator(".habit-card-a")
        .filter({ hasText: definitions[index].name });
    await card(1).click();
    await expect(card(1)).toHaveAttribute("aria-pressed", "true");
    await expect(card(0)).toHaveAttribute("aria-pressed", "false");
    await expect
      .poll(
        async () =>
          (
            await pool.query(
              "select completed from habit_completions where habit_id = $1",
              [definitions[1].id],
            )
          ).rows,
      )
      .toEqual([{ completed: true }]);
    await page.reload();
    await orderedNames();
    await expect(card(1)).toHaveAttribute("aria-pressed", "true");
    await card(5)
      .getByRole("button", { name: /minimum/ })
      .click();
    await expect
      .poll(
        async () =>
          (
            await pool.query(
              "select completed, notes from habit_completions where habit_id = $1",
              [definitions[5].id],
            )
          ).rows,
      )
      .toEqual([{ completed: true, notes: "minimum" }]);
    await page.reload();
    await orderedNames();
    await expect(card(5)).toHaveAttribute("aria-pressed", "true");
    await card(5).click();
    await expect
      .poll(
        async () =>
          (
            await pool.query(
              "select completed from habit_completions where habit_id = $1",
              [definitions[5].id],
            )
          ).rows,
      )
      .toEqual([{ completed: false }]);
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const response = await request.post("/habits/week", {
      form: {
        intent: "toggle-completion",
        habitId: definitions[0].id,
        completed: "false",
        date: yesterday.toISOString().slice(0, 10),
      },
    });
    expect(response.ok()).toBe(true);
    await page.reload();
    await orderedNames();
    await expect(card(0)).toHaveAttribute("aria-pressed", "false");
    expect(
      (
        await pool.query(
          "select completed, completion_date::text as date from habit_completions where habit_id = $1",
          [definitions[0].id],
        )
      ).rows,
    ).toEqual([
      { completed: true, date: yesterday.toISOString().slice(0, 10) },
    ]);
    await expect(page.getByText("Later today", { exact: true })).toBeVisible();
  } finally {
    await pool.query(
      "delete from habit_completions where habit_id = any($1::uuid[])",
      [ids],
    );
    await pool.query("delete from habits where id = any($1::uuid[])", [ids]);
    await pool.end();
  }
});
