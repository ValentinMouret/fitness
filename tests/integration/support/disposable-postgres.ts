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
import { z } from "zod";

export function createDisposablePostgres(adminUrl: URL) {
  if (!["localhost", "127.0.0.1", "[::1]"].includes(adminUrl.hostname))
    throw new Error(
      "Tenant tests require a loopback disposable PostgreSQL admin connection",
    );
  const databaseName = `fitness_tenant_test_${randomUUID().replaceAll("-", "")}`;
  const databaseUrl = new URL(adminUrl);
  databaseUrl.pathname = `/${databaseName}`;
  const admin = new Client({ connectionString: adminUrl.toString() });
  const pool = new Pool({ connectionString: databaseUrl.toString() });
  const database = drizzle(pool);
  const folders: string[] = [];
  let created = false;
  return {
    pool,
    database,
    async create() {
      await admin.connect();
      await admin.query(
        `create database ${admin.escapeIdentifier(databaseName)}`,
      );
      created = true;
    },
    async migrateBefore(index: number) {
      const folder = await mkdtemp(
        join(tmpdir(), "fitness-ownership-migration-"),
      );
      folders.push(folder);
      await mkdir(join(folder, "meta"));
      const journal = z
        .object({
          version: z.string(),
          dialect: z.string(),
          entries: z.array(
            z.object({
              idx: z.number(),
              version: z.string(),
              when: z.number(),
              tag: z.string(),
              breakpoints: z.boolean(),
            }),
          ),
        })
        .parse(
          JSON.parse(await readFile("drizzle/meta/_journal.json", "utf8")),
        );
      const prior = {
        ...journal,
        entries: journal.entries.filter((entry) => entry.idx < index),
      };
      await writeFile(
        join(folder, "meta/_journal.json"),
        JSON.stringify(prior),
      );
      for (const entry of prior.entries)
        await copyFile(
          `drizzle/${entry.tag}.sql`,
          join(folder, `${entry.tag}.sql`),
        );
      await migrate(database, { migrationsFolder: folder });
    },
    async close() {
      await pool.end();
      if (created)
        await admin.query(
          `drop database ${admin.escapeIdentifier(databaseName)}`,
        );
      await admin.end();
      for (const folder of folders)
        await rm(folder, { recursive: true, force: true });
    },
  };
}
