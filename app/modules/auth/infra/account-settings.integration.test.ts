import { randomUUID } from "node:crypto";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { afterAll, beforeAll, expect, it } from "vitest";
import { z } from "zod";
import { createDisposablePostgres } from "../../../../tests/integration/support/disposable-postgres";
import { userIdSchema } from "../domain/user";
import {
  getAccountTimeZone,
  getAccountToday,
  requireAccountToday,
  saveAccountTimeZone,
} from "./account-settings.server";

const fixture = createDisposablePostgres(
  new URL(z.url().parse(process.env.TENANT_TEST_ADMIN_URL)),
);
const a = userIdSchema.parse(randomUUID());
const b = userIdSchema.parse(randomUUID());
const instant = new Date("2026-01-01T11:30:00Z");
beforeAll(async () => {
  await fixture.create();
  await migrate(fixture.database, { migrationsFolder: "drizzle" });
  await fixture.pool.query(
    "insert into auth_users(id,name,email) values ($1,'A','a@example.invalid'),($2,'B','b@example.invalid')",
    [a, b],
  );
});
afterAll(() => fixture.close());

it("persists each actor's device zone and changes neither another account nor historical records", async () => {
  const workout = randomUUID();
  await fixture.pool.query(
    "insert into workouts(id,user_id,name,start,stop) values ($1,$2,'Retained history','2025-01-01T10:00:00Z','2025-01-01T11:00:00Z')",
    [workout, a],
  );
  const before = (
    await fixture.pool.query("select * from workouts where id=$1", [workout])
  ).rows;
  expect(await getAccountTimeZone(a, fixture.database)).toBeNull();
  expect(
    (await getAccountToday(a, instant, fixture.database)).toISOString(),
  ).toBe("2026-01-01T00:00:00.000Z");
  await expect(
    requireAccountToday(a, instant, fixture.database),
  ).rejects.toMatchObject({ status: 409 });
  await saveAccountTimeZone(a, "America/Los_Angeles", fixture.database);
  expect(
    (await requireAccountToday(a, instant, fixture.database)).toISOString(),
  ).toBe("2026-01-01T00:00:00.000Z");
  await saveAccountTimeZone(b, "Pacific/Auckland", fixture.database);
  expect(
    (await getAccountToday(a, instant, fixture.database)).toISOString(),
  ).toBe("2026-01-01T00:00:00.000Z");
  expect(
    (await getAccountToday(b, instant, fixture.database)).toISOString(),
  ).toBe("2026-01-02T00:00:00.000Z");
  await saveAccountTimeZone(b, "Europe/Paris", fixture.database);
  expect(await getAccountTimeZone(a, fixture.database)).toBe(
    "America/Los_Angeles",
  );
  expect(await getAccountTimeZone(b, fixture.database)).toBe("Europe/Paris");
  expect(
    (await fixture.pool.query("select * from workouts where id=$1", [workout]))
      .rows,
  ).toEqual(before);
  await expect(
    saveAccountTimeZone(
      userIdSchema.parse(randomUUID()),
      "UTC",
      fixture.database,
    ),
  ).rejects.toThrow();
});
