import { randomUUID } from "node:crypto";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { expect, it } from "vitest";
import { z } from "zod";
import { bootstrapAuthOwner } from "~/modules/auth/infra/owner-bootstrap.server";
import { createDisposablePostgres } from "../../../../tests/integration/support/disposable-postgres";

const generated = "workouts_template_id_workout_templates_id_fk";
const legacy = "workouts_template_id_fkey";

it.each([generated, legacy])(
  "migrates retained workouts with the recognized %s template foreign key",
  async (name) => {
    const fixture = createDisposablePostgres(
      new URL(z.url().parse(process.env.TENANT_TEST_ADMIN_URL)),
    );
    const owner = randomUUID(),
      workout = randomUUID(),
      template = randomUUID();
    try {
      await fixture.create();
      await fixture.migrateBefore(16);
      if (name !== generated)
        await fixture.pool.query(
          `alter table workouts rename constraint ${generated} to ${legacy}`,
        );
      await fixture.pool.query(
        "insert into workouts (id,name,start,notes,deleted_at) values ($1,'Restored historic workout','1900-01-01','Retained owner notes','1900-01-02')",
        [workout],
      );
      await fixture.pool.query(
        "insert into workout_templates (id,name,source_workout_id) values ($1,'Restored template',$2)",
        [template, workout],
      );
      await fixture.pool.query(
        "update workouts set template_id=$1 where id=$2",
        [template, workout],
      );
      const before = (await fixture.pool.query("select * from workouts")).rows;
      expect(
        (
          await bootstrapAuthOwner({
            pool: fixture.pool,
            id: owner,
            email: `${owner}@example.invalid`,
            now: new Date(),
          })
        ).isOk(),
      ).toBe(true);
      await migrate(fixture.database, { migrationsFolder: "./drizzle" });
      expect((await fixture.pool.query("select * from workouts")).rows).toEqual(
        before.map((row) => ({ ...row, user_id: owner })),
      );
      expect(
        (
          await fixture.pool.query(
            "select template_id from workouts where id=$1",
            [workout],
          )
        ).rows,
      ).toEqual([{ template_id: template }]);
      const foreign = randomUUID();
      await fixture.pool.query(
        "insert into auth_users (id,name,email) values ($1,'Other',$2)",
        [foreign, `${foreign}@example.invalid`],
      );
      await expect(
        fixture.pool.query(
          "insert into workouts (user_id,name,start,template_id) values ($1,'Cross-account','1900-01-03',$2)",
          [foreign, template],
        ),
      ).rejects.toMatchObject({ code: "23503" });
    } finally {
      await fixture.close();
    }
  },
);

it.each(["unknown", "duplicate", "wrong_target"])(
  "refuses %s template constraints and rolls back ownership DDL",
  async (shape) => {
    const fixture = createDisposablePostgres(
      new URL(z.url().parse(process.env.TENANT_TEST_ADMIN_URL)),
    );
    try {
      await fixture.create();
      await fixture.migrateBefore(16);
      if (shape === "unknown")
        await fixture.pool.query(
          `alter table workouts rename constraint ${generated} to unexpected_template_fk`,
        );
      if (shape === "duplicate")
        await fixture.pool.query(
          `alter table workouts add constraint ${legacy} foreign key(template_id) references workout_templates(id)`,
        );
      if (shape === "wrong_target") {
        await fixture.pool.query(
          `alter table workouts drop constraint ${generated}`,
        );
        await fixture.pool.query(
          `alter table workouts add constraint ${generated} foreign key(template_id) references workouts(id)`,
        );
      }
      const before = (
        await fixture.pool.query(
          "select conname,pg_get_constraintdef(oid) as definition from pg_constraint where conrelid='workouts'::regclass order by conname",
        )
      ).rows;
      await expect(
        migrate(fixture.database, { migrationsFolder: "./drizzle" }),
      ).rejects.toThrow();
      expect(
        (
          await fixture.pool.query(
            "select conname,pg_get_constraintdef(oid) as definition from pg_constraint where conrelid='workouts'::regclass order by conname",
          )
        ).rows,
      ).toEqual(before);
      expect(
        (
          await fixture.pool.query(
            "select column_name from information_schema.columns where table_schema='public' and table_name='workouts' and column_name='user_id'",
          )
        ).rows,
      ).toEqual([]);
    } finally {
      await fixture.close();
    }
  },
);
