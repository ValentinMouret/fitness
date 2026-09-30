import { randomUUID } from "node:crypto";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client, Pool } from "pg";
import { expect, it } from "vitest";

it("migrates existing assignments and keeps template identity, logs and reader grants", async () => {
  const admin = new Client({
    connectionString: process.env.NUTRITION_TEST_DATABASE_URL,
  });
  const name = `fitness_meal_test_${randomUUID().replaceAll("-", "")}`;
  const role = `meal_reader_${randomUUID().replaceAll("-", "")}`;
  const url = new URL(process.env.NUTRITION_TEST_DATABASE_URL ?? "");
  url.pathname = `/${name}`;
  const pool = new Pool({ connectionString: url.toString() });
  const folder = await mkdtemp(join(tmpdir(), "fitness-meal-migration-"));
  let created = false;
  let roleCreated = false;
  try {
    await admin.connect();
    await admin.query(`create database ${admin.escapeIdentifier(name)}`);
    created = true;
    await mkdir(join(folder, "meta"));
    const journal = JSON.parse(
      await readFile("drizzle/meta/_journal.json", "utf8"),
    );
    const entries = journal.entries.filter(
      (entry: { idx: number }) => entry.idx < 11,
    );
    await writeFile(
      join(folder, "meta/_journal.json"),
      JSON.stringify({ ...journal, entries }),
    );
    for (const entry of entries)
      await copyFile(
        `drizzle/${entry.tag}.sql`,
        join(folder, `${entry.tag}.sql`),
      );
    const database = drizzle(pool);
    await migrate(database, { migrationsFolder: folder });
    for (const category of ["breakfast", "lunch", "dinner", "snack"])
      await pool.query(
        "insert into meal_templates (name, category, notes, total_calories, total_protein,total_carbs,total_fat,total_fiber,satiety_score) values ($1,$2,'Preserved notes',123,10,20,3,4,5)",
        [category, category],
      );
    await pool.query(
      "insert into meal_logs (meal_category,logged_date,meal_template_id) select 'dinner','1901-01-02',id from meal_templates where category = 'lunch'",
    );
    const before = (
      await pool.query(
        "select to_jsonb(t) as record from meal_templates t order by name",
      )
    ).rows;
    const logs = (
      await pool.query("select to_jsonb(l) as record from meal_logs l")
    ).rows;
    await admin.query(`create role ${admin.escapeIdentifier(role)}`);
    roleCreated = true;
    await pool.query(
      `grant usage on schema fitness_data to ${admin.escapeIdentifier(role)}`,
    );
    await pool.query(
      `grant select on fitness_data.meal_templates to ${admin.escapeIdentifier(role)}`,
    );
    const assignment = journal.entries.find(
      (entry: { idx: number }) => entry.idx === 11,
    );
    await copyFile(
      `drizzle/${assignment.tag}.sql`,
      join(folder, `${assignment.tag}.sql`),
    );
    await writeFile(
      join(folder, "meta/_journal.json"),
      JSON.stringify({ ...journal, entries: [...entries, assignment] }),
    );
    await migrate(database, { migrationsFolder: folder });
    const after = (
      await pool.query(
        "select to_jsonb(t) as record from meal_templates t order by name",
      )
    ).rows;
    expect(after).toEqual(
      before.map(({ record }) => {
        const { category, ...rest } = record;
        return { record: { ...rest, categories: [category] } };
      }),
    );
    expect(
      (await pool.query("select to_jsonb(l) as record from meal_logs l")).rows,
    ).toEqual(logs);
    await pool.query(`set role ${admin.escapeIdentifier(role)}`);
    expect(
      (
        await pool.query(
          "select name,category,categories from fitness_data.meal_templates order by name",
        )
      ).rows,
    ).toEqual(
      ["breakfast", "dinner", "lunch", "snack"].map((category) => ({
        name: category,
        category,
        categories: [category],
      })),
    );
    await pool.query("reset role");
    await expect(
      pool.query(
        "update meal_templates set categories = '{}' where name = 'lunch'",
      ),
    ).rejects.toThrow();
    await expect(
      pool.query(
        "update meal_templates set categories = array['lunch','lunch']::meal_category[] where name = 'lunch'",
      ),
    ).rejects.toThrow();
  } finally {
    if (created && roleCreated) {
      await pool.query("reset role");
      await pool.query(`drop owned by ${admin.escapeIdentifier(role)}`);
    }
    await pool.end();
    if (created)
      await admin.query(`drop database ${admin.escapeIdentifier(name)}`);
    if (roleCreated)
      await admin.query(`drop role ${admin.escapeIdentifier(role)}`);
    await admin.end();
    await rm(folder, { recursive: true, force: true });
  }
}, 30000);
