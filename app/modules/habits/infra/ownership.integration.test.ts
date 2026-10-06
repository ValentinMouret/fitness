import { randomUUID } from "node:crypto";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { userIdSchema } from "~/modules/auth/domain/user";
import { findLegacyOwner } from "~/modules/auth/infra/legacy-owner.server";
import { bootstrapAuthOwner } from "~/modules/auth/infra/owner-bootstrap.server";
import { createDisposablePostgres } from "../../../../tests/integration/support/disposable-postgres";
import { Habit, HabitCompletion } from "../domain/entity";
import { createHabitRepositories } from "./repository.server";

const adminUrl = new URL(z.url().parse(process.env.TENANT_TEST_ADMIN_URL));
const fixture = createDisposablePostgres(adminUrl);
const { database, pool } = fixture;
const ownerId = userIdSchema.parse(randomUUID());
const otherId = userIdSchema.parse(randomUUID());
const legacyIds = [randomUUID(), randomUUID(), randomUUID()];
let originalHabits: readonly Record<string, unknown>[] = [];
let originalCompletions: readonly Record<string, unknown>[] = [];

beforeAll(async () => {
  await fixture.create();
  await fixture.migrateBefore(13);
  await pool.query(
    `insert into habits (id, name, frequency_type, start_date, is_active, deleted_at)
    values ($1, 'Active history', 'daily', '2020-01-01', true, null),
           ($2, 'Inactive history', 'daily', '2020-01-01', false, null),
           ($3, 'Deleted history', 'daily', '2020-01-01', false, now())`,
    legacyIds,
  );
  await pool.query(
    `insert into habit_completions (habit_id, completion_date, completed, notes, deleted_at)
    values ($1, '2020-01-01', true, 'Historical note', null),
           ($2, '2020-01-01', false, null, null),
           ($3, '2020-01-01', true, 'Deleted completion', now())`,
    legacyIds,
  );
  originalHabits = (await pool.query("select * from habits order by id")).rows;
  originalCompletions = (
    await pool.query("select * from habit_completions order by habit_id")
  ).rows;
});

afterAll(() => fixture.close());

describe.sequential(
  "explicit owner backfill and personal habit ownership",
  () => {
    it("refuses historical backfill without an explicit owner and rolls back DDL", async () => {
      await expect(
        migrate(database, { migrationsFolder: "./drizzle" }),
      ).rejects.toThrow();
      expect(
        (await pool.query("select * from habits order by id")).rows,
      ).toEqual(originalHabits);
      expect(
        (await pool.query("select * from habit_completions order by habit_id"))
          .rows,
      ).toEqual(originalCompletions);
    });

    it("refuses ambiguous owner identities without assigning any historical records", async () => {
      for (const id of [ownerId, otherId]) {
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
      }
      await expect(
        migrate(database, { migrationsFolder: "./drizzle" }),
      ).rejects.toThrow();
      expect(
        (await pool.query("select * from habits order by id")).rows,
      ).toEqual(originalHabits);
      await pool.query("delete from auth_users where id=$1", [otherId]);
    });

    it("preserves every active, inactive, deleted record and completion while assigning the owner", async () => {
      await migrate(database, { migrationsFolder: "./drizzle" });
      const records = (await pool.query("select * from habits order by id"))
        .rows;
      expect(records.map(({ user_id, ...record }) => record)).toEqual(
        originalHabits,
      );
      expect(records.every((record) => record.user_id === ownerId)).toBe(true);
      expect(
        (await pool.query("select * from habit_completions order by habit_id"))
          .rows,
      ).toEqual(originalCompletions);
      expect((await findLegacyOwner(database, ownerId))?.id).toBe(ownerId);
      expect(await findLegacyOwner(database, randomUUID())).toBeNull();
      await pool.query(
        "insert into auth_users (id,name,email) values ($1,'Other account','other@example.invalid')",
        [otherId],
      );
      expect(await findLegacyOwner(database, otherId)).toBeNull();
      await pool.query(
        "update auth_invitations set revoked_at=now() where user_id=$1",
        [ownerId],
      );
      expect(await findLegacyOwner(database, ownerId)).toBeNull();
      await pool.query(
        "update auth_invitations set revoked_at=null where user_id=$1",
        [ownerId],
      );
    });

    it("isolates definitions, edits, soft deletion and completion upserts by the trusted actor", async () => {
      const owner = createHabitRepositories(ownerId, database);
      const other = createHabitRepositories(otherId, database);
      const saved = (
        await other.habits.save(Habit.create("Private habit", "daily", {}))
      )._unsafeUnwrap();
      if (!saved) throw new Error("Missing inserted habit");
      expect((await owner.habits.fetchById(saved.id))._unsafeUnwrapErr()).toBe(
        "not_found",
      );
      expect(
        (
          await owner.habits.save({ ...saved, name: "Forged edit" })
        )._unsafeUnwrapErr(),
      ).toBe("not_found");
      expect((await owner.habits.delete(saved.id))._unsafeUnwrapErr()).toBe(
        "not_found",
      );
      expect(
        (await other.habits.fetchById(saved.id))._unsafeUnwrap().name,
      ).toBe("Private habit");
      expect(
        (await owner.habits.fetchAll())
          ._unsafeUnwrap()
          .map((habit) => habit.id)
          .sort(),
      ).toEqual([...legacyIds].sort());
      expect(
        (await other.habits.fetchActive())
          ._unsafeUnwrap()
          .map((habit) => habit.id),
      ).toEqual([saved.id]);
      const date = new Date("2020-01-02");
      const completion = HabitCompletion.create(
        saved.id,
        date,
        true,
        "Private completion",
      );
      expect(
        (await owner.completions.save(completion))._unsafeUnwrapErr(),
      ).toBe("not_found");
      expect((await other.completions.save(completion)).isOk()).toBe(true);
      expect(
        (
          await owner.completions.save({ ...completion, completed: false })
        )._unsafeUnwrapErr(),
      ).toBe("not_found");
      expect(
        (
          await owner.completions.fetchByHabitAndDate(saved.id, date)
        )._unsafeUnwrap(),
      ).toBeNull();
      expect(
        (
          await owner.completions.fetchByHabitBetween(saved.id, date, date)
        )._unsafeUnwrap(),
      ).toEqual([]);
      expect(
        (await owner.completions.fetchByDateRange(date, date))._unsafeUnwrap(),
      ).toEqual([]);
      expect(
        (await other.completions.fetchByDateRange(date, date))._unsafeUnwrap(),
      ).toEqual([completion]);
      expect(
        (
          await other.completions.save({ ...completion, completed: false })
        ).isOk(),
      ).toBe(true);
      expect(
        (
          await other.completions.fetchByHabitAndDate(saved.id, date)
        )._unsafeUnwrap()?.completed,
      ).toBe(false);
      expect((await other.habits.delete(saved.id)).isOk()).toBe(true);
      expect((await other.habits.fetchActive())._unsafeUnwrap()).toEqual([]);
      expect((await other.habits.fetchAll())._unsafeUnwrap()).toHaveLength(1);
      expect(
        (
          await other.completions.fetchByHabitAndDate(saved.id, date)
        )._unsafeUnwrap()?.completed,
      ).toBe(false);
    });
  },
);
