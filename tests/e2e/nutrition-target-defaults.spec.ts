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

test("labels unsaved defaults, ignores foreign targets, and preserves saved zero", async ({
  page,
  request,
}) => {
  const pool = new pg.Pool({ connectionString: process.env.E2E_DATABASE_URL });
  const otherId = randomUUID();
  const targetId = randomUUID();
  const otherTargetId = randomUUID();
  const ownerId = fixtureOwnerId();
  try {
    await verifyFixtureServerDatabase(request, pool);
    const existing = await pool.query(
      "select id from targets where user_id=$1 and measurement_name='daily_calorie_intake' and deleted_at is null",
      [ownerId],
    );
    expect(
      existing.rows,
      "This test needs an empty synthetic owner target; never replace existing goals",
    ).toHaveLength(0);
    await pool.query(
      "insert into auth_users(id,name,email) values ($1,'Target fixture',$2)",
      [otherId, `${otherId}@example.invalid`],
    );
    await pool.query(
      "insert into measurements(user_id,name,unit) values ($1,'daily_calorie_intake','Cal')",
      [otherId],
    );
    await pool.query(
      "insert into targets(id,user_id,measurement_name,value) values ($1,$2,'daily_calorie_intake',9876)",
      [otherTargetId, otherId],
    );
    for (const path of ["/nutrition", "/dashboard"]) {
      await page.goto(path);
      await expect(
        page.getByText(/Default (nutrition )?targets\./),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: "Set your own" }),
      ).toHaveAttribute("href", "/nutrition/calculate-targets");
      await expect(page.locator("body")).not.toContainText("9876");
    }
    await pool.query(
      "insert into targets(id,user_id,measurement_name,value) values ($1,$2,'daily_calorie_intake',2000)",
      [targetId, ownerId],
    );
    for (const path of ["/nutrition", "/dashboard"]) {
      await page.goto(path);
      await expect(
        page.getByText(/Default (nutrition )?targets\./),
      ).toHaveCount(0);
    }
    await page.goto("/nutrition");
    await expect(page.getByText(/\d+% of 2000 kcal target/)).toBeVisible();
    await pool.query("update targets set value=0 where id=$1", [targetId]);
    await page.reload();
    await expect(
      page.getByText("0 kcal target", { exact: true }),
    ).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/NaN|Infinity/);
    await page.goto("/dashboard");
    await expect(page.getByText("Zero target")).toHaveCount(2);
    await expect(page.getByText(/Default (nutrition )?targets\./)).toHaveCount(
      0,
    );
  } finally {
    await pool.query("delete from targets where id=any($1::uuid[])", [
      [targetId, otherTargetId],
    ]);
    await pool.query("delete from measurements where user_id=$1", [otherId]);
    await pool.query("delete from auth_users where id=$1", [otherId]);
    await pool.end();
  }
});
