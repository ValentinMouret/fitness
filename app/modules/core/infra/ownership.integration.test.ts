import { randomUUID } from "node:crypto";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { userIdSchema } from "~/modules/auth/domain/user";
import { bootstrapAuthOwner } from "~/modules/auth/infra/owner-bootstrap.server";
import { createDailyNoteRepository } from "~/modules/daily-note/infra/repository.server";
import { createDisposablePostgres } from "../../../../tests/integration/support/disposable-postgres";
import { Measure } from "../domain/measure";
import { Target } from "../domain/target";
import { createMeasureRepository } from "./measure.repository.server";
import { createMeasurementRepository } from "./measurements.repository.server";
import { createTargetRepository } from "./target.repository.server";

const fixture = createDisposablePostgres(
  new URL(z.url().parse(process.env.TENANT_TEST_ADMIN_URL)),
);
const { database, pool } = fixture;
const ownerId = userIdSchema.parse(randomUUID());
const otherId = userIdSchema.parse(randomUUID());
const activeTargetId = randomUUID();
const deletedTargetId = randomUUID();
const tables = ["measurements", "measures", "targets", "daily_note"];
let original: readonly (readonly Record<string, unknown>[])[] = [];

async function records() {
  return Promise.all(
    tables.map(
      async (table) =>
        (await pool.query(`select * from ${table} order by 1,2`)).rows,
    ),
  );
}

beforeAll(async () => {
  await fixture.create();
  await fixture.migrateBefore(14);
  await pool.query(`insert into measurements (name,unit,description,deleted_at)
    values ('weight','kg','Historical weight',null),
           ('daily_calorie_intake','Cal','Historical calories',null),
           ('private_owner','cm','Private definition',now())`);
  await pool.query(`insert into measures (measurement_name,t,value)
    values ('weight','1900-01-01 10:00:00',81), ('weight','1900-01-01 18:00:00',82), ('private_owner','1900-01-01 10:00:00',12)`);
  await pool.query(
    `insert into targets (id,measurement_name,value,deleted_at)
    values ($1,'daily_calorie_intake',2300,null), ($2,'daily_calorie_intake',1800,now())`,
    [activeTargetId, deletedTargetId],
  );
  await pool.query(
    "insert into daily_note (id,content,updated_at) values (1,'Private historical note',now())",
  );
  original = await records();
});

afterAll(() => fixture.close());

describe.sequential(
  "personal measurement, target and daily note ownership",
  () => {
    it("rolls back measurement ownership DDL and records without an explicit owner", async () => {
      await expect(
        migrate(database, { migrationsFolder: "./drizzle" }),
      ).rejects.toThrow();
      expect(await records()).toEqual(original);
    });

    it("rejects ambiguous owner identity before assigning any private record", async () => {
      for (const id of [ownerId, otherId])
        expect(
          (
            await bootstrapAuthOwner({
              pool,
              id,
              email: `${id}@example.invalid`,
              now: new Date(),
            })
          ).isOk(),
        ).toBe(true);
      await expect(
        migrate(database, { migrationsFolder: "./drizzle" }),
      ).rejects.toThrow();
      expect(await records()).toEqual(original);
      await pool.query("delete from auth_users where id=$1", [otherId]);
    });

    it("preserves definitions, timestamps, repeated weights, deleted targets and the daily note", async () => {
      await migrate(database, { migrationsFolder: "./drizzle" });
      const migrated = await records();
      expect(
        migrated.map((rows) => rows.map(({ user_id, ...row }) => row)),
      ).toEqual(original);
      expect(
        migrated.every((rows) => rows.every((row) => row.user_id === ownerId)),
      ).toBe(true);
      await pool.query(
        "insert into auth_users (id,name,email) values ($1,'Other account','other@example.invalid')",
        [otherId],
      );
    });

    it("separates same-named definitions, same-timestamp logs, targets and singleton notes", async () => {
      const ownerDefinitions = createMeasurementRepository(ownerId, database);
      const otherDefinitions = createMeasurementRepository(otherId, database);
      expect(
        (
          await otherDefinitions.save({
            name: "weight",
            unit: "kg",
            description: "Other private definition",
          })
        ).isOk(),
      ).toBe(true);
      expect(
        (await ownerDefinitions.fetchByName("weight"))._unsafeUnwrap()
          .description,
      ).toBe("Historical weight");
      expect(
        (await otherDefinitions.fetchByName("weight"))._unsafeUnwrap()
          .description,
      ).toBe("Other private definition");
      expect(
        (
          await otherDefinitions.fetchByName("private_owner")
        )._unsafeUnwrapErr(),
      ).toBe("not_found");
      expect(
        (await otherDefinitions.fetchAll())
          ._unsafeUnwrap()
          .map((row) => row.name),
      ).toEqual(["weight"]);
      const ownerLogs = createMeasureRepository(ownerId, database);
      const otherLogs = createMeasureRepository(otherId, database);
      const date = new Date("2020-05-02T10:00:00Z");
      expect(
        (await ownerLogs.save(Measure.create("weight", 80, date))).isOk(),
      ).toBe(true);
      expect(
        (await otherLogs.save(Measure.create("weight", 50, date))).isOk(),
      ).toBe(true);
      expect(
        (await ownerLogs.fetchBetween("weight", date, date))._unsafeUnwrap()[0]
          ?.value,
      ).toBe(80);
      expect(
        (await otherLogs.fetchBetween("weight", date, date))._unsafeUnwrap()[0]
          ?.value,
      ).toBe(50);
      expect(
        (await otherLogs.save(Measure.create("weight", 51, date))).isOk(),
      ).toBe(true);
      expect(
        (await ownerLogs.fetchByMeasurementName("weight", 1))._unsafeUnwrap()[0]
          ?.value,
      ).toBe(80);
      expect((await otherLogs.fetchAll("weight"))._unsafeUnwrap()).toHaveLength(
        1,
      );
      expect(
        (
          await otherLogs.save(Measure.create("private_owner", 99, date))
        ).isErr(),
      ).toBe(true);
      expect(
        (
          await otherLogs.delete(
            "private_owner",
            new Date("1900-01-01T10:00:00Z"),
          )
        )._unsafeUnwrapErr(),
      ).toBe("not_found");
      expect(
        (await ownerLogs.fetchAll("private_owner"))._unsafeUnwrap()[0]?.value,
      ).toBe(12);
      const ownerTargets = createTargetRepository(ownerId, database);
      const otherTargets = createTargetRepository(otherId, database);
      const ownerTarget = Target.create({ measurement: "weight", value: 78 });
      const otherTarget = Target.create({ measurement: "weight", value: 60 });
      expect((await ownerTargets.set(ownerTarget)).isOk()).toBe(true);
      expect((await otherTargets.set(otherTarget)).isOk()).toBe(true);
      expect(
        (
          await otherTargets.set({ ...ownerTarget, value: 999 })
        )._unsafeUnwrapErr(),
      ).toBe("not_found");
      expect((await otherTargets.listAllActive())._unsafeUnwrap()).toEqual([
        otherTarget,
      ]);
      expect(
        (await ownerTargets.listAllActive())
          ._unsafeUnwrap()
          .find((row) => row.measurement === "weight"),
      ).toEqual(ownerTarget);
      expect(
        (
          await otherTargets.set(
            Target.create({ measurement: "private_owner", value: 99 }),
          )
        )._unsafeUnwrapErr(),
      ).toBe("not_found");
      const ownerNotes = createDailyNoteRepository(ownerId, database);
      const otherNotes = createDailyNoteRepository(otherId, database);
      expect((await otherNotes.fetch())._unsafeUnwrap()).toBeUndefined();
      expect((await otherNotes.save("Other private note")).isOk()).toBe(true);
      expect((await ownerNotes.fetch())._unsafeUnwrap()?.content).toBe(
        "Private historical note",
      );
      expect((await ownerNotes.save("Updated owner note")).isOk()).toBe(true);
      expect((await otherNotes.fetch())._unsafeUnwrap()?.content).toBe(
        "Other private note",
      );
    });

    it("serializes concurrent target replacement and rolls back a forged cross-account identifier", async () => {
      const ownerTargets = createTargetRepository(ownerId, database);
      const otherTargets = createTargetRepository(otherId, database);
      const beforeOther = (await otherTargets.listAllActive())._unsafeUnwrap();
      const beforeOwner = (await ownerTargets.listAllActive())
        ._unsafeUnwrap()
        .find((target) => target.measurement === "weight");
      if (!beforeOwner) throw new Error("Missing owner target fixture");
      const next = Target.create({ measurement: "weight", value: 77 });
      const [legitimate, forged] = await Promise.all([
        ownerTargets.set(next),
        otherTargets.set({ ...beforeOwner, value: 999 }),
      ]);
      expect(legitimate.isOk()).toBe(true);
      expect(forged._unsafeUnwrapErr()).toBe("not_found");
      expect((await otherTargets.listAllActive())._unsafeUnwrap()).toEqual(
        beforeOther,
      );
      const replacements = [76, 75].map((value) =>
        Target.create({ measurement: "weight", value }),
      );
      const results = await Promise.all(
        replacements.map((target) => ownerTargets.set(target)),
      );
      expect(results.every((result) => result.isOk())).toBe(true);
      const active = (await ownerTargets.listAllActive())
        ._unsafeUnwrap()
        .filter((target) => target.measurement === "weight");
      expect(active).toHaveLength(1);
      expect(replacements).toContainEqual(active[0]);
      expect(
        (
          await pool.query(
            "select id from targets where user_id=$1 and measurement_name='weight' and deleted_at is not null",
            [ownerId],
          )
        ).rowCount,
      ).toBe(3);
    });
  },
);
