import {
  boolean,
  date,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
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

export const habits = pgTable("habits", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  description: text(),
  frequency_type: text().notNull(), // 'daily', 'weekly', 'monthly', 'custom'
  frequency_config: jsonb().notNull().default({}),
  target_count: integer().notNull().default(1),
  start_date: date().notNull(),
  end_date: date(),
  is_active: boolean().notNull().default(true),
  ...timestampColumns(),
});

export const habit_completions = pgTable(
  "habit_completions",
  {
    habit_id: uuid()
      .references(() => habits.id)
      .notNull(),
    completion_date: date().notNull(),
    completed: boolean().notNull(),
    notes: text(),
    ...timestampColumns(),
  },
  (table) => [primaryKey({ columns: [table.habit_id, table.completion_date] })],
);
