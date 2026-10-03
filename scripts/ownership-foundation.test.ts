import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import {
  type CatalogEntry,
  foundationCatalogFingerprint,
  verifyFoundationJournal,
} from "./ownership-foundation";

const journal = JSON.parse(
  await readFile("drizzle/meta/_journal.json", "utf8"),
);
const expected = await Promise.all(
  journal.entries
    .slice(0, 13)
    .map(async (entry: { tag: string; when: number }) => ({
      hash: createHash("sha256")
        .update(await readFile(`drizzle/${entry.tag}.sql`, "utf8"))
        .digest("hex"),
      createdAt: entry.when,
    })),
);
const historical = [
  { hash: "0000_spicy_randall_flagg", createdAt: 1770755498152 },
  { hash: "0001_solid_doctor_doom", createdAt: 1772781615263 },
  ...expected.slice(2),
];

it("accepts the canonical and exact observed historical journal without changing either", () => {
  const before = JSON.stringify(historical);
  expect(verifyFoundationJournal(expected, expected)).toBe("canonical");
  expect(verifyFoundationJournal(historical, expected)).toBe(
    "historical tag journal",
  );
  expect(JSON.stringify(historical)).toBe(before);
});

for (const [name, applied] of [
  [
    "unknown tag",
    [
      { ...historical[0], hash: "0000_spicy_randall_flagh" },
      ...historical.slice(1),
    ],
  ],
  [
    "unknown timestamp",
    [
      historical[0],
      { ...historical[1], createdAt: historical[1].createdAt + 1 },
      ...historical.slice(2),
    ],
  ],
  ["mixed historical/canonical", [historical[0], ...expected.slice(1)]],
  ["mixed canonical/historical", [expected[0], ...historical.slice(1)]],
  [
    "later hash drift",
    [
      ...historical.slice(0, 2),
      { ...historical[2], hash: "unknown" },
      ...historical.slice(3),
    ],
  ],
  ["reordered entries", [historical[1], historical[0], ...historical.slice(2)]],
  ["missing entry", historical.slice(0, 12)],
  ["extra entry", [...historical, historical[12]]],
] as const) {
  it(`rejects ${name}`, () => {
    expect(() => verifyFoundationJournal(applied, expected)).toThrow();
  });
}

it("does not apply the historical exception to changed reviewed migration SQL", () => {
  expect(() =>
    verifyFoundationJournal(historical, [
      { ...expected[0], hash: "changed" },
      ...expected.slice(1),
    ]),
  ).toThrow();
});

const catalog: readonly CatalogEntry[] = [
  {
    kind: "column",
    name: "workout_template_sets.template_id",
    detail: { type: "uuid", notNull: true, default: null },
  },
  {
    kind: "constraint",
    name: "workout_template_sets.workout_template_sets_template_id_exercise_id_set_pk",
    detail: {
      definition: "PRIMARY KEY (template_id, exercise_id, set)",
      validated: true,
    },
  },
  {
    kind: "index",
    name: "workout_template_sets.workout_template_sets_template_id_exercise_id_set_pk",
    detail: {
      definition:
        "CREATE UNIQUE INDEX workout_template_sets_template_id_exercise_id_set_pk ON public.workout_template_sets USING btree (template_id, exercise_id, set)",
      valid: true,
    },
  },
  { kind: "enum", name: "exercise_type", detail: ["barbell", "cable"] },
];

it("normalizes only reviewed historical names and guarded PostgreSQL18 NOT NULL representation", () => {
  const historicalCatalog: readonly CatalogEntry[] = [
    catalog[0],
    { ...catalog[1], name: "workout_template_sets.workout_template_sets_pk" },
    {
      kind: "index",
      name: "workout_template_sets.workout_template_sets_pk",
      detail: {
        definition:
          "CREATE UNIQUE INDEX workout_template_sets_pk ON public.workout_template_sets USING btree (template_id, exercise_id, set)",
        valid: true,
      },
    },
    catalog[3],
    {
      kind: "constraint",
      name: "workout_template_sets.template_id_not_null",
      detail: { definition: "NOT NULL template_id", validated: true },
    },
  ];
  expect(foundationCatalogFingerprint(historicalCatalog)).toBe(
    foundationCatalogFingerprint(catalog),
  );
  expect(foundationCatalogFingerprint([...catalog].reverse())).toBe(
    foundationCatalogFingerprint(catalog),
  );
});

it("retains unknown names, definitions, enum order and duplicate constraints in the fingerprint", () => {
  const fingerprint = foundationCatalogFingerprint(catalog);
  const mutations: readonly (readonly [number, CatalogEntry])[] = [
    [1, { ...catalog[1], name: "workout_template_sets.unreviewed_pk" }],
    [
      1,
      {
        ...catalog[1],
        detail: {
          definition: "PRIMARY KEY (template_id, exercise_id)",
          validated: true,
        },
      },
    ],
    [
      2,
      {
        ...catalog[2],
        detail: {
          definition:
            "CREATE INDEX workout_template_sets_template_id_exercise_id_set_pk ON public.workout_template_sets USING btree (template_id, exercise_id, set)",
          valid: true,
        },
      },
    ],
    [3, { ...catalog[3], detail: ["cable", "barbell"] }],
  ];
  for (const [index, entry] of mutations) {
    expect(
      foundationCatalogFingerprint(
        catalog.map((original, position) =>
          position === index ? entry : original,
        ),
      ),
    ).not.toBe(fingerprint);
  }
  expect(foundationCatalogFingerprint([...catalog, catalog[1]])).not.toBe(
    fingerprint,
  );
});

it("rejects unguarded or unvalidated NOT NULL constraints and invalid indexes", () => {
  const refused: readonly CatalogEntry[] = [
    {
      kind: "constraint",
      name: "workout_template_sets.unknown_not_null",
      detail: { definition: "NOT NULL unknown", validated: true },
    },
    {
      kind: "constraint",
      name: "workout_template_sets.template_id_not_null",
      detail: { definition: "NOT NULL template_id", validated: false },
    },
    {
      ...catalog[2],
      detail: {
        definition:
          "CREATE INDEX x ON public.workout_template_sets (template_id)",
        valid: false,
      },
    },
  ];
  for (const entry of refused) {
    expect(() => foundationCatalogFingerprint([...catalog, entry])).toThrow();
  }
});
