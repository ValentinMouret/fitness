import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import pg from "pg";
import { z } from "zod";
import {
  canWriteFixtureDatabase,
  verifyFixtureServerDatabase,
} from "./support/fixture-database";

test.skip(
  !canWriteFixtureDatabase(process.env.E2E_DATABASE_URL),
  "Requires a matching dedicated fixture database and server",
);
test.use({ viewport: { width: 390, height: 844 } });

test("measurement routes and dashboard exclude another account's definitions, history and note", async ({
  page,
  request,
}) => {
  const pool = new pg.Pool({ connectionString: process.env.E2E_DATABASE_URL });
  const ownerId = z.uuid().parse(process.env.AUTH_FOUNDATION_OWNER_USER_ID);
  const otherId = randomUUID();
  const name = `private_${randomUUID().replaceAll("-", "")}`;
  const description = `Other private definition ${randomUUID()}`;
  const note = `Other private note ${randomUUID()}`;
  const targetId = randomUUID();
  try {
    await verifyFixtureServerDatabase(request, pool);
    await pool.query(
      "insert into auth_users (id,name,email) values ($1,'Other measurement account',$2)",
      [otherId, `${otherId}@example.invalid`],
    );
    await pool.query(
      "insert into auth_invitations (user_id,invited_by,expires_at,accepted_at) values ($1,$2,now(),now())",
      [otherId, ownerId],
    );
    await pool.query(
      "insert into measurements (user_id,name,unit,description) values ($1,$2,'cm',$3),($1,'weight','kg',null),($1,'daily_calorie_intake','Cal',null)",
      [otherId, name, description],
    );
    await pool.query(
      "insert into measures (user_id,measurement_name,t,value) values ($1,$2,'2099-01-01',12),($1,'weight','2099-01-01',9999)",
      [otherId, name],
    );
    await pool.query(
      "insert into targets (user_id,id,measurement_name,value) values ($1,$2,'daily_calorie_intake',1300)",
      [otherId, targetId],
    );
    await pool.query(
      "insert into daily_note (user_id,id,content) values ($1,1,$2)",
      [otherId, note],
    );
    await page.goto("/measurements");
    await expect(page.getByText(name, { exact: true })).toHaveCount(0);
    await page.goto("/measurements/weight");
    await expect(page.getByText("9999", { exact: true })).toHaveCount(0);
    await page.goto("/dashboard");
    await expect(page.getByText(note, { exact: true })).toHaveCount(0);
    await expect(page.getByText("9999", { exact: true })).toHaveCount(0);
    for (const path of [
      `/measurements/${name}`,
      `/measurements/${name}.data`,
    ]) {
      const response = await request.get(path);
      expect(response.status()).toBe(404);
      expect(await response.text()).not.toContain(description);
    }
    expect(
      (
        await request.post(`/measurements/${name}`, {
          form: { intent: "add-measure", value: "99", date: "2099-01-01" },
        })
      ).status(),
    ).toBe(404);
    for (const measurement of [name, "weight"])
      expect(
        (
          await request.post(`/measurements/${measurement}`, {
            form: { intent: "delete-measure", date: "2099-01-01" },
          })
        ).status(),
      ).toBe(404);
    expect(
      (
        await pool.query(
          "select measurement_name,value from measures where user_id=$1 order by measurement_name",
          [otherId],
        )
      ).rows,
    ).toEqual([
      { measurement_name: name, value: 12 },
      { measurement_name: "weight", value: 9999 },
    ]);
    expect(
      (
        await pool.query("select content from daily_note where user_id=$1", [
          otherId,
        ])
      ).rows,
    ).toEqual([{ content: note }]);
    expect(
      (
        await pool.query("select value,deleted_at from targets where id=$1", [
          targetId,
        ])
      ).rows,
    ).toEqual([{ value: 1300, deleted_at: null }]);
  } finally {
    await pool.query("delete from daily_note where user_id=$1", [otherId]);
    await pool.query("delete from targets where user_id=$1", [otherId]);
    await pool.query("delete from measures where user_id=$1", [otherId]);
    await pool.query("delete from measurements where user_id=$1", [otherId]);
    await pool.query("delete from auth_users where id=$1", [otherId]);
    await pool.end();
  }
});
