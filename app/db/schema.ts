import {
  doublePrecision,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const timestampColumns = () => ({
  created_at: timestamp().notNull().defaultNow(),
  updated_at: timestamp(),
  deleted_at: timestamp(),
});

export const measurements = pgTable("measurements", {
  name: text().primaryKey(),
  unit: text().notNull(),
  description: text(),
  ...timestampColumns(),
});

export const measures = pgTable(
  "measures",
  {
    measurement_name: text()
      .references(() => measurements.name)
      .notNull(),
    t: timestamp().notNull().defaultNow(),
    value: doublePrecision().notNull(),
  },
  (table) => [primaryKey({ columns: [table.measurement_name, table.t] })],
);
