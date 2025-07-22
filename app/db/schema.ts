import { isNull, sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  doublePrecision,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { exerciseTypes, muscleGroups } from "~/modules/fitness/domain/workout";

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

export const targets = pgTable(
  "targets",
  {
    id: uuid().defaultRandom().primaryKey(),
    measurement_name: text()
      .references(() => measurements.name)
      .notNull(),
    value: doublePrecision().notNull(),
    ...timestampColumns(),
  },
  (table) => [
    uniqueIndex("idx_targets_measurement_active")
      .on(table.measurement_name)
      .where(isNull(table.deleted_at)),
  ],
);

// Workouts
export const exerciseType = pgEnum("exercise_type", exerciseTypes);

export const exercises = pgTable(
  "exercises",
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull(),
    description: text(),
    type: exerciseType().notNull(),
    ...timestampColumns(),
  },
  (table) => [
    uniqueIndex("exercises_name_type_unique_idx")
      .on(table.name, table.type)
      .where(isNull(table.deleted_at)),
  ],
);

export const muscleGroupsEnum = pgEnum("muscle_group", muscleGroups);
export const exerciseMuscleGroups = pgTable(
  "exercise_muscle_groups",
  {
    exercise: uuid()
      .references(() => exercises.id)
      .notNull(),
    muscle_group: muscleGroupsEnum().notNull(),
    split: integer().notNull(),
    ...timestampColumns(),
  },
  (table) => [
    primaryKey({ columns: [table.exercise, table.muscle_group] }),
    check(
      "split_is_percentage",
      sql`${table.split} > 0 and ${table.split} <= 100`,
    ),
  ],
);

export const workouts = pgTable("workouts", {
  id: uuid().defaultRandom().primaryKey(),
  name: text().notNull(),
  start: timestamp().defaultNow(),
  stop: timestamp(),
  notes: text(),
  ...timestampColumns(),
});

export const workoutExercises = pgTable(
  "workout_exercises",
  {
    workout_id: uuid()
      .references(() => workouts.id)
      .notNull(),
    exercise_id: uuid()
      .references(() => exercises.id)
      .notNull(),
    order_index: integer().notNull(),
    notes: text(),
    ...timestampColumns(),
  },
  (table) => [
    primaryKey({ columns: [table.workout_id, table.exercise_id] }),
    check("order_index_positive", sql`${table.order_index} >= 0`),
    uniqueIndex("workout_exercises_active_unique_idx")
      .on(table.workout_id, table.exercise_id)
      .where(isNull(table.deleted_at)),
    uniqueIndex("workout_exercises_order_unique_idx")
      .on(table.workout_id, table.order_index)
      .where(isNull(table.deleted_at)),
  ],
);

export const workoutSets = pgTable(
  "workout_sets",
  {
    workout: uuid()
      .references(() => workouts.id)
      .notNull(),
    exercise: uuid()
      .references(() => exercises.id)
      .notNull(),
    set: integer().notNull(),
    targetReps: integer(),
    reps: integer(),
    weight: doublePrecision(),
    note: text(),
    isCompleted: boolean().notNull().default(false),
    isFailure: boolean().notNull().default(false),
    ...timestampColumns(),
  },
  (table) => [
    primaryKey({ columns: [table.workout, table.exercise, table.set] }),
    check("set_is_positive", sql`${table.set} > 0`),
    check(
      "target_reps_is_null_or_positive",
      sql`${table.targetReps} is null or ${table.targetReps} > 0`,
    ),
    check(
      "reps_is_null_or_positive",
      sql`${table.reps} is null or ${table.reps} > 0`,
    ),
    check(
      "weight_is_null_or_positive",
      sql`${table.weight} is null or ${table.weight} > 0`,
    ),
  ],
);
