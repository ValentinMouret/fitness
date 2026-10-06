import { createHash } from "node:crypto";

type Migration = {
  readonly hash: string;
  readonly createdAt: number;
};

export type CatalogEntry = {
  readonly kind: string;
  readonly name: string;
  readonly detail:
    | readonly string[]
    | Readonly<Record<string, string | boolean | null>>;
};

const historicalPair: readonly Migration[] = [
  { hash: "0000_spicy_randall_flagg", createdAt: 1770755498152 },
  { hash: "0001_solid_doctor_doom", createdAt: 1772781615263 },
];
const reviewedPair: readonly Migration[] = [
  {
    hash: "ac6d13c1c33b7593c3db4cfd200cc971d6b35eae04fe910b9c883d98f297156c",
    createdAt: 1770755498152,
  },
  {
    hash: "9187eca34cbda7b1bba1eefe8360d95e37fac492390c020f0888fe19ad492b7d",
    createdAt: 1770881599790,
  },
];
const sameMigration = (left: Migration, right: Migration) =>
  left.hash === right.hash && left.createdAt === right.createdAt;

export function verifyFoundationJournal(
  applied: readonly Migration[],
  expected: readonly Migration[],
): "canonical" | "historical tag journal" {
  if (applied.length !== 13 || expected.length !== 13)
    throw new Error("Rehearsal source must end exactly at foundation0012");
  const canonical = applied.every((entry, index) =>
    sameMigration(entry, expected[index]),
  );
  const historical =
    reviewedPair.every((entry, index) =>
      sameMigration(entry, expected[index]),
    ) &&
    applied.every((entry, index) =>
      sameMigration(entry, index < 2 ? historicalPair[index] : expected[index]),
    );
  if (!canonical && !historical)
    throw new Error(
      "Source migration journal does not match the reviewed foundation stack",
    );
  return canonical ? "canonical" : "historical tag journal";
}

const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("hex");

// Exact equivalent CHECK renderings observed on PostgreSQL 14 and 18.
const mealAssignmentChecks = [
  "33cb3d44e37d05778a0f13285d3bbf08ab966effce8fa747e7e0c11582a9c6b4",
  "04134cacadddd4ba5c9940160b3b0b05931a4e9fcb4dec2e37bc9e23527cfd11",
];

const historicalNames: Readonly<Record<string, string>> = {
  "workout_template_exercises.workout_template_exercises_pk":
    "workout_template_exercises.workout_template_exercises_template_id_exercise_id_pk",
  "workout_template_exercises.workout_template_exercises_exercise_id_fkey":
    "workout_template_exercises.workout_template_exercises_exercise_id_exercises_id_fk",
  "workout_template_exercises.workout_template_exercises_template_id_fkey":
    "workout_template_exercises.workout_template_exercises_template_id_workout_templates_id_fk",
  "workout_template_sets.workout_template_sets_pk":
    "workout_template_sets.workout_template_sets_template_id_exercise_id_set_pk",
  "workout_template_sets.workout_template_sets_exercise_id_fkey":
    "workout_template_sets.workout_template_sets_exercise_id_exercises_id_fk",
  "workout_template_sets.workout_template_sets_template_id_fkey":
    "workout_template_sets.workout_template_sets_template_id_workout_templates_id_fk",
};

const isEnumDetail = (
  value: CatalogEntry["detail"],
): value is readonly string[] => Array.isArray(value);

export function foundationCatalogFingerprint(
  entries: readonly CatalogEntry[],
): string {
  const normalized = entries.flatMap((entry) => {
    if (isEnumDetail(entry.detail))
      return [JSON.stringify([entry.kind, entry.name, entry.detail])];
    const detail = { ...entry.detail };
    let name = entry.name;
    if (entry.kind === "constraint") {
      if (typeof detail.definition !== "string")
        throw new Error("Invalid foundation constraint metadata");
      if (detail.validated !== true)
        throw new Error("Unvalidated foundation constraint");
      // PostgreSQL 18 also represents column NOT NULL as constraints.
      if (detail.definition.startsWith("NOT NULL ")) {
        const column =
          /^NOT NULL (?:"((?:[^"]|"")+)"|([a-z_][a-z0-9_]*))$/.exec(
            detail.definition,
          );
        const columnName = column?.[1]?.replaceAll('""', '"') ?? column?.[2];
        const guarded = entries.some(
          (candidate) =>
            candidate.kind === "column" &&
            candidate.name === `${name.split(".")[0]}.${columnName}` &&
            !isEnumDetail(candidate.detail) &&
            candidate.detail.notNull === true,
        );
        if (!guarded)
          throw new Error("Unexpected foundation NOT NULL constraint");
        return [];
      }
      if (
        name === "meal_templates.meal_assignments_valid" &&
        mealAssignmentChecks.includes(sha256(detail.definition))
      )
        detail.definition = "reviewed meal assignment check";
      name = historicalNames[name] ?? name;
    }
    if (entry.kind === "index") {
      if (typeof detail.definition !== "string" || detail.valid !== true)
        throw new Error("Invalid foundation index metadata");
      const canonicalName = historicalNames[name];
      if (canonicalName) {
        detail.definition = detail.definition.replace(
          `INDEX ${name.split(".")[1]} ON`,
          `INDEX ${canonicalName.split(".")[1]} ON`,
        );
        name = canonicalName;
      }
    }
    return [
      JSON.stringify([
        entry.kind,
        name,
        Object.entries(detail).sort(([left], [right]) =>
          left < right ? -1 : left > right ? 1 : 0,
        ),
      ]),
    ];
  });
  return sha256(JSON.stringify(normalized.sort()));
}

export const foundationCatalogSql = `
select kind, name, detail
from (
  select 'table' as kind, c.relname::text as name,
         jsonb_build_object('kind', c.relkind, 'rls', c.relrowsecurity) as detail
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relkind in ('r','p')
  union all
  select 'column', c.relname || '.' || a.attname,
         jsonb_build_object('type', format_type(a.atttypid,a.atttypmod),
                            'notNull',a.attnotnull,
                            'default',pg_get_expr(d.adbin,d.adrelid),
                            'identity',a.attidentity,'generated',a.attgenerated)
    from pg_attribute a join pg_class c on c.oid=a.attrelid
    join pg_namespace n on n.oid=c.relnamespace
    left join pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum
   where n.nspname='public' and c.relkind in ('r','p') and a.attnum>0 and not a.attisdropped
  union all
  select 'constraint', c.relname || '.' ||
         case when c.relname='workouts' and k.conname='workouts_template_id_fkey'
              then 'workouts_template_id_workout_templates_id_fk' else k.conname end,
         jsonb_build_object('definition',pg_get_constraintdef(k.oid),'validated',k.convalidated)
    from pg_constraint k join pg_class c on c.oid=k.conrelid
    join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relkind in ('r','p')
  union all
  select 'index', c.relname || '.' || i.relname,
         jsonb_build_object('definition',pg_get_indexdef(i.oid), 'valid', x.indisvalid)
    from pg_index x join pg_class c on c.oid=x.indrelid
    join pg_class i on i.oid=x.indexrelid join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relkind in ('r','p')
  union all
  select 'enum', t.typname, to_jsonb(array_agg(e.enumlabel order by e.enumsortorder))
    from pg_type t join pg_namespace n on n.oid=t.typnamespace
    join pg_enum e on e.enumtypid=t.oid
   where n.nspname='public' group by t.typname
) catalog
order by kind collate "C", name collate "C";
`;
