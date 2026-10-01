import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { promisify } from "node:util";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { z } from "zod";
import { invitedEmailSchema } from "../app/modules/auth/domain/invitation";
import { bootstrapAuthOwner } from "../app/modules/auth/infra/owner-bootstrap.server";

const config = z
  .object({
    OWNERSHIP_REHEARSAL_DATABASE_URL: z.url().refine((value) => {
      const url = new URL(value);
      return (
        url.protocol === "postgresql:" &&
        !url.search &&
        !url.hash &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
        /^\/fitness_(ownership_rehearsal_test|tenant_test)_[a-z0-9_]+$/.test(
          url.pathname,
        )
      );
    }, "Only an explicitly named isolated loopback rehearsal/test copy is allowed"),
    OWNERSHIP_REHEARSAL_OWNER_ID: z.uuid(),
    OWNERSHIP_REHEARSAL_OWNER_EMAIL: invitedEmailSchema,
    OWNERSHIP_REHEARSAL_ARTIFACT_DIR: z.string().refine(isAbsolute),
  })
  .parse(process.env);
if (process.argv.slice(2).some((value) => value !== "--apply"))
  throw new Error("Only --apply is supported; default is read-only preflight");
const apply = process.argv.includes("--apply");
const owned = [
  "habits",
  "measurements",
  "measures",
  "targets",
  "daily_note",
  "oauth_connections",
  "workouts",
  "workout_templates",
  "ingredients",
  "meal_templates",
  "meal_logs",
  "meal_template_ingredients",
  "meal_log_ingredients",
  "gym_floors",
  "equipment_instances",
  "equipment_preferences",
  "training_preferences",
  "generation_conversations",
] as const;
const children = [
  "habit_completions",
  "oauth_authorization_codes",
  "oauth_tokens",
  "workout_exercises",
  "workout_sets",
  "workout_template_exercises",
  "workout_template_sets",
] as const;
const targetUrl = new URL(config.OWNERSHIP_REHEARSAL_DATABASE_URL);
targetUrl.port ||= "5432";
const pool = new Pool({ connectionString: targetUrl.toString() });
const summary = async () =>
  Promise.all(
    [...owned, ...children].map(async (table) => ({
      table,
      ...z
        .object({ count: z.string(), digest: z.string() })
        .parse(
          (
            await pool.query(
              `select count(*)::text as count, md5(coalesce(string_agg((to_jsonb(r)-'user_id')::text,E'\\n' order by (to_jsonb(r)-'user_id')::text),'')) as digest from ${table} r`,
            )
          ).rows[0],
        ),
    })),
  );
const exerciseContentSummary = async (migrated: boolean) => {
  const content = migrated
    ? `(to_jsonb(e)-'description'-'mmc_instructions') || jsonb_build_object('description',p.description,'mmc_instructions',p.mmc_instructions)`
    : "to_jsonb(e)";
  const join = migrated
    ? "left join exercise_preferences p on p.exercise_id=e.id and p.user_id=$1"
    : "";
  return z
    .object({ count: z.string(), digest: z.string() })
    .parse(
      (
        await pool.query(
          `select count(*)::text as count, md5(coalesce(string_agg((${content})::text,E'\\n' order by e.id),'')) as digest from exercises e ${join}`,
          migrated ? [config.OWNERSHIP_REHEARSAL_OWNER_ID] : [],
        )
      ).rows[0],
    );
};
try {
  const journal = z
    .object({
      entries: z.array(
        z.object({ idx: z.number(), when: z.number(), tag: z.string() }),
      ),
    })
    .parse(JSON.parse(await readFile("drizzle/meta/_journal.json", "utf8")));
  const expected = journal.entries.filter((entry) => entry.idx < 13);
  if (journal.entries.length !== 21)
    throw new Error(
      "Review the rehearsal script for a changed migration stack",
    );
  const applied = (
    await pool.query(
      "select hash,created_at from drizzle.__drizzle_migrations order by created_at",
    )
  ).rows;
  if (applied.length !== expected.length)
    throw new Error("Rehearsal source must end exactly at foundation0012");
  for (const [index, entry] of expected.entries()) {
    const sql = await readFile(`drizzle/${entry.tag}.sql`, "utf8");
    if (
      applied[index].hash !== createHash("sha256").update(sql).digest("hex") ||
      Number(applied[index].created_at) !== entry.when
    )
      throw new Error(
        "Source migration journal does not match the reviewed foundation stack",
      );
  }
  const owners = (
    await pool.query(
      "select user_id from auth_invitations where user_id=invited_by and accepted_at is not null and revoked_at is null",
    )
  ).rows;
  if (
    owners.some((row) => row.user_id !== config.OWNERSHIP_REHEARSAL_OWNER_ID) ||
    owners.length > 1
  )
    throw new Error(
      "Ambiguous or conflicting accepted owner; review rather than reassign",
    );
  const identity = (
    await pool.query(
      "select id,email from auth_users where id=$1 or email=$2",
      [
        config.OWNERSHIP_REHEARSAL_OWNER_ID,
        config.OWNERSHIP_REHEARSAL_OWNER_EMAIL,
      ],
    )
  ).rows;
  if (
    identity.some(
      (row) =>
        row.id !== config.OWNERSHIP_REHEARSAL_OWNER_ID ||
        row.email !== config.OWNERSHIP_REHEARSAL_OWNER_EMAIL,
    )
  )
    throw new Error("Owner UUID/email conflict");
  const orphans = (
    await pool.query(`
    select 'workout_set_membership' as relation,count(*)::int as count from workout_sets s where not exists(select 1 from workout_exercises e where e.workout_id=s.workout and e.exercise_id=s.exercise)
    union all select 'template_set_membership',count(*)::int from workout_template_sets s where not exists(select 1 from workout_template_exercises e where e.template_id=s.template_id and e.exercise_id=s.exercise_id)
    union all select 'template_source',count(*)::int from workout_templates t where t.source_workout_id is not null and not exists(select 1 from workouts w where w.id=t.source_workout_id)
    union all select 'template_ingredient',count(*)::int from meal_template_ingredients c where not exists(select 1 from meal_templates t where t.id=c.meal_template_id) or not exists(select 1 from ingredients i where i.id=c.ingredient_id)
    union all select 'meal_ingredient',count(*)::int from meal_log_ingredients c where not exists(select 1 from meal_logs l where l.id=c.meal_log_id) or not exists(select 1 from ingredients i where i.id=c.ingredient_id)
    union all select 'consumed_template',count(*)::int from meal_logs l where l.meal_template_id is not null and not exists(select 1 from meal_templates t where t.id=l.meal_template_id)
    union all select 'equipment_floor',count(*)::int from equipment_instances e where not exists(select 1 from gym_floors f where f.id=e.gym_floor_id)
    union all select 'conversation_workout',count(*)::int from generation_conversations c where c.workout_id is not null and not exists(select 1 from workouts w where w.id=c.workout_id)
  `)
  ).rows;
  if (orphans.some((row) => row.count !== 0))
    throw new Error(`Orphan preflight failed: ${JSON.stringify(orphans)}`);
  const before = await summary();
  const exerciseContentBefore = await exerciseContentSummary(false);
  if (!apply) {
    console.log(
      JSON.stringify({
        mode: "read-only preflight",
        pendingMigrations: 8,
        tables: before,
        exerciseContent: exerciseContentBefore,
        orphans,
      }),
    );
  } else {
    // Backup before owner bootstrap; never operate on the live source.
    const folder = join(
      config.OWNERSHIP_REHEARSAL_ARTIFACT_DIR,
      `ownership-${randomUUID()}`,
    );
    await mkdir(folder, { recursive: true, mode: 0o700 });
    const backup = join(folder, "before.dump");
    const url = new URL(config.OWNERSHIP_REHEARSAL_DATABASE_URL);
    await promisify(execFile)(
      "pg_dump",
      ["--format=custom", `--file=${backup}`],
      {
        env: {
          ...Object.fromEntries(
            Object.entries(process.env).filter(
              ([key]) => !key.startsWith("PG"),
            ),
          ),
          PGHOST: url.hostname.replace(/^\[|\]$/g, ""),
          PGPORT: url.port || "5432",
          PGUSER:
            decodeURIComponent(url.username) ||
            process.env.PGUSER ||
            process.env.USER,
          PGPASSWORD:
            decodeURIComponent(url.password) || process.env.PGPASSWORD,
          PGDATABASE: url.pathname.slice(1),
        },
        timeout: 60000,
      },
    );
    await chmod(backup, 0o600);
    console.log(JSON.stringify({ stage: "before-bootstrap", backup }));
    const started = Date.now();
    const result = await bootstrapAuthOwner({
      pool,
      id: config.OWNERSHIP_REHEARSAL_OWNER_ID,
      email: config.OWNERSHIP_REHEARSAL_OWNER_EMAIL,
      now: new Date(),
    });
    if (result.isErr()) throw new Error(result.error);
    const accepted = (
      await pool.query(
        "select user_id from auth_invitations where user_id=invited_by and accepted_at is not null and revoked_at is null",
      )
    ).rows;
    if (
      accepted.length !== 1 ||
      accepted[0].user_id !== config.OWNERSHIP_REHEARSAL_OWNER_ID
    )
      throw new Error(
        `Owner bootstrap did not produce exactly one accepted identity; backup: ${backup}`,
      );
    await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
    const after = await summary();
    const exerciseContentAfter = await exerciseContentSummary(true);
    if (
      JSON.stringify(exerciseContentBefore) !==
      JSON.stringify(exerciseContentAfter)
    )
      throw new Error(
        `Private exercise content reconciliation failed; preserve backup ${backup}`,
      );
    if (JSON.stringify(before) !== JSON.stringify(after))
      throw new Error(
        `History reconciliation failed; preserve copy and recover into a new isolated database from ${backup}`,
      );
    for (const table of [...owned, "exercise_preferences"]) {
      const rows = (
        await pool.query(
          `select count(*)::int as foreign from ${table} where user_id is distinct from $1`,
          [config.OWNERSHIP_REHEARSAL_OWNER_ID],
        )
      ).rows;
      if (rows[0].foreign !== 0)
        throw new Error(`Ownership reconciliation failed for ${table}`);
    }
    const report = join(folder, "report.json");
    await writeFile(
      report,
      JSON.stringify(
        {
          mode: "isolated-copy rehearsal",
          migrationMs: Date.now() - started,
          backup,
          before,
          after,
          exerciseContentBefore,
          exerciseContentAfter,
          orphans,
          ownerId: config.OWNERSHIP_REHEARSAL_OWNER_ID,
        },
        null,
        2,
      ),
      { mode: 0o600, flag: "wx" },
    );
    console.log(JSON.stringify({ status: "preserved", report, backup }));
  }
} finally {
  await pool.end();
}
