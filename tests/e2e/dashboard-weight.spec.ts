import { expect, test } from "@playwright/test";
import pg from "pg";
import {
  canWriteFixtureDatabase,
  verifyFixtureServerDatabase,
} from "./support/fixture-database";

const databaseUrl = process.env.E2E_DATABASE_URL;
test.skip(
  !canWriteFixtureDatabase(databaseUrl),
  "Requires an explicitly isolated test database matching the server",
);
test.use({ viewport: { width: 390, height: 844 } });

test("weight entry remains available after today's reading and repeated saves", async ({
  page,
  request,
}) => {
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const startedAt = new Date().toISOString();
  const seedValue = 70 + Math.floor(Math.random() * 900000) / 100000;
  const values = [seedValue + 0.00001, seedValue + 0.00002];
  const timestamps: string[] = [];
  try {
    await verifyFixtureServerDatabase(request, pool);
    const existing = await pool.query(
      "select t from measures where measurement_name = 'weight' and (t = $1 or value = any($2::numeric[]))",
      [startedAt, [seedValue, ...values]],
    );
    expect(existing.rows).toHaveLength(0);
    await pool.query(
      "insert into measures (measurement_name, t, value) values ('weight', $1, $2)",
      [startedAt, seedValue],
    );
    timestamps.push(startedAt);
    await page.goto("/dashboard");
    const input = page.getByRole("textbox", { name: "Weight", exact: true });
    const log = page.getByRole("button", { name: "Log", exact: true });
    for (const value of values) {
      await expect(input).toBeVisible();
      await input.fill(String(value));
      const saved = page.waitForResponse(
        (response) =>
          response.url().includes("/dashboard.data") &&
          response.request().method() === "POST",
      );
      await log.click();
      expect((await saved).ok()).toBe(true);
      await expect(log).toBeEnabled();
      await expect(input).toBeVisible();
      const persisted = await pool.query(
        "select t::text as timestamp from measures where measurement_name = 'weight' and t >= $1 and value = $2",
        [startedAt, value],
      );
      expect(persisted.rows).toHaveLength(1);
      timestamps.push(persisted.rows[0].timestamp);
    }
    await page.reload();
    await expect(input).toBeVisible();
    await expect(log).toBeEnabled();
  } finally {
    await pool.query(
      "delete from measures where measurement_name = 'weight' and t = any($1::timestamp[])",
      [timestamps],
    );
    await pool.end();
  }
});
