import { isNull, sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  doublePrecision,
  foreignKey,
  index,
  integer,
  jsonb,
  type PgTableExtraConfigValue,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const authUsers = pgTable("auth_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const authSessions = pgTable(
  "auth_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("auth_sessions_user_id_idx").on(table.userId)],
);

export const authAccounts = pgTable("auth_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => authUsers.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", {
    withTimezone: true,
  }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
    withTimezone: true,
  }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const authVerifications = pgTable(
  "auth_verifications",
  {
    id: text("id").primaryKey().default(sql`gen_random_uuid()::text`),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("auth_verifications_identifier_idx").on(table.identifier)],
);

export const authInvitations = pgTable("auth_invitations", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => authUsers.id, { onDelete: "cascade" }),
  invitedBy: uuid("invited_by")
    .notNull()
    .references(() => authUsers.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

import {
  exerciseTypes,
  movementPatterns,
  muscleGroups,
  reportedRirValues,
} from "~/modules/fitness/domain/workout";
import {
  ingredientCategories,
  textureCategories,
} from "~/modules/nutrition/domain/ingredient";
import { mealCategories } from "~/modules/nutrition/domain/meal-template";

export const timestampColumns = () => ({
  created_at: timestamp().notNull().defaultNow(),
  updated_at: timestamp(),
  deleted_at: timestamp(),
});

export const measurements = pgTable(
  "measurements",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id),
    name: text().notNull(),
    unit: text().notNull(),
    description: text(),
    ...timestampColumns(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.name] })],
);

export const measures = pgTable(
  "measures",
  {
    userId: uuid("user_id").notNull(),
    measurement_name: text().notNull(),
    t: timestamp().notNull().defaultNow(),
    value: doublePrecision().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.measurement_name, table.t] }),
    foreignKey({
      columns: [table.userId, table.measurement_name],
      foreignColumns: [measurements.userId, measurements.name],
    }),
  ],
);

export const habits = pgTable(
  "habits",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id),
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull(),
    description: text(),
    identity_phrase: text().notNull().default(""),
    time_of_day: text().notNull().default(""),
    location: text().notNull().default(""),
    is_keystone: boolean().notNull().default(false),
    minimal_version: text().notNull().default(""),
    color: text().notNull().default("#e15a46"),
    frequency_type: text().notNull(), // 'daily', 'weekly', 'monthly', 'custom'
    frequency_config: jsonb().notNull().default({}),
    target_count: integer().notNull().default(1),
    start_date: date().notNull(),
    end_date: date(),
    is_active: boolean().notNull().default(true),
    ...timestampColumns(),
  },
  (table) => [index("habits_user_id_idx").on(table.userId)],
);

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
    userId: uuid("user_id").notNull(),
    measurement_name: text().notNull(),
    value: doublePrecision().notNull(),
    ...timestampColumns(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId, table.measurement_name],
      foreignColumns: [measurements.userId, measurements.name],
    }),
    uniqueIndex("idx_targets_measurement_active")
      .on(table.userId, table.measurement_name)
      .where(isNull(table.deleted_at)),
  ],
);

// Workouts
export const exerciseType = pgEnum("exercise_type", exerciseTypes);
export const movementPattern = pgEnum("movement_pattern", movementPatterns);

export const exercises = pgTable(
  "exercises",
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull(),
    description: text(),
    mmc_instructions: text(),
    type: exerciseType().notNull(),
    movement_pattern: movementPattern().notNull(),
    setup_time_seconds: integer().notNull().default(30),
    complexity_score: integer().notNull().default(1),
    equipment_sharing_friendly: boolean().notNull().default(false),
    requires_spotter: boolean().notNull().default(false),
    ...timestampColumns(),
  },
  (table) => [
    uniqueIndex("exercises_name_type_unique_idx")
      .on(table.name, table.type)
      .where(isNull(table.deleted_at)),
    check("setup_time_positive", sql`${table.setup_time_seconds} >= 0`),
    check(
      "complexity_score_range",
      sql`${table.complexity_score} >= 1 and ${table.complexity_score} <= 5`,
    ),
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

export const workoutTemplates = pgTable(
  "workout_templates",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id),
    id: uuid().defaultRandom().primaryKey(),
    name: text().notNull(),
    source_workout_id: uuid(),
    ...timestampColumns(),
  },
  (table): PgTableExtraConfigValue[] => [
    uniqueIndex("workout_templates_user_id_id_idx").on(table.userId, table.id),
    foreignKey({
      columns: [table.userId, table.source_workout_id],
      foreignColumns: [workouts.userId, workouts.id],
    }),
  ],
);

export const workoutTemplateExercises = pgTable(
  "workout_template_exercises",
  {
    template_id: uuid()
      .references(() => workoutTemplates.id)
      .notNull(),
    exercise_id: uuid()
      .references(() => exercises.id)
      .notNull(),
    order_index: integer().notNull(),
    notes: text(),
    ...timestampColumns(),
  },
  (table) => [
    primaryKey({ columns: [table.template_id, table.exercise_id] }),
    check("template_order_index_positive", sql`${table.order_index} >= 0`),
  ],
);

export const workoutTemplateSets = pgTable(
  "workout_template_sets",
  {
    template_id: uuid()
      .references(() => workoutTemplates.id)
      .notNull(),
    exercise_id: uuid()
      .references(() => exercises.id)
      .notNull(),
    set: integer().notNull(),
    target_reps: integer(),
    weight: doublePrecision(),
    is_warmup: boolean().notNull().default(false),
    ...timestampColumns(),
  },
  (table) => [
    primaryKey({ columns: [table.template_id, table.exercise_id, table.set] }),
    foreignKey({
      columns: [table.template_id, table.exercise_id],
      foreignColumns: [
        workoutTemplateExercises.template_id,
        workoutTemplateExercises.exercise_id,
      ],
    }),
    check("template_set_is_positive", sql`${table.set} > 0`),
  ],
);

export const workouts = pgTable(
  "workouts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id),
    id: uuid().defaultRandom().primaryKey(),
    name: text().notNull(),
    start: timestamp().defaultNow(),
    stop: timestamp(),
    notes: text(),
    imported_from_strong: boolean().notNull().default(false),
    imported_from_fitbod: boolean().notNull().default(false),
    template_id: uuid(),
    ...timestampColumns(),
  },
  (table): PgTableExtraConfigValue[] => [
    uniqueIndex("workouts_user_id_id_idx").on(table.userId, table.id),
    foreignKey({
      columns: [table.userId, table.template_id],
      foreignColumns: [workoutTemplates.userId, workoutTemplates.id],
    }),
  ],
);

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

// Adaptive Workout Generator Schema
export const gymFloors = pgTable(
  "gym_floors",
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull(),
    floor_number: integer().notNull(),
    description: text(),
    ...timestampColumns(),
  },
  (table) => [
    uniqueIndex("gym_floors_number_unique_idx")
      .on(table.floor_number)
      .where(isNull(table.deleted_at)),
    check("floor_number_positive", sql`${table.floor_number} > 0`),
  ],
);

export const equipmentInstances = pgTable(
  "equipment_instances",
  {
    id: uuid().primaryKey().defaultRandom(),
    exercise_type: exerciseType().notNull(),
    gym_floor_id: uuid()
      .references(() => gymFloors.id)
      .notNull(),
    name: text().notNull(),
    capacity: integer().notNull().default(1),
    is_available: boolean().notNull().default(true),
    ...timestampColumns(),
  },
  (table) => [
    uniqueIndex("equipment_instances_name_floor_unique_idx")
      .on(table.name, table.gym_floor_id)
      .where(isNull(table.deleted_at)),
    check("capacity_positive", sql`${table.capacity} > 0`),
  ],
);

export const equipmentPreferences = pgTable(
  "equipment_preferences",
  {
    muscle_group: muscleGroupsEnum().notNull(),
    exercise_type: exerciseType().notNull(),
    preference_score: integer().notNull(),
    ...timestampColumns(),
  },
  (table) => [
    primaryKey({ columns: [table.muscle_group, table.exercise_type] }),
    check(
      "preference_score_range",
      sql`${table.preference_score} >= 1 and ${table.preference_score} <= 10`,
    ),
  ],
);

export const exerciseSubstitutions = pgTable(
  "exercise_substitutions",
  {
    primary_exercise_id: uuid()
      .references(() => exercises.id)
      .notNull(),
    substitute_exercise_id: uuid()
      .references(() => exercises.id)
      .notNull(),
    similarity_score: doublePrecision().notNull(),
    muscle_overlap_percentage: integer().notNull(),
    difficulty_difference: integer().notNull().default(0),
    ...timestampColumns(),
  },
  (table) => [
    primaryKey({
      columns: [table.primary_exercise_id, table.substitute_exercise_id],
    }),
    check(
      "similarity_score_range",
      sql`${table.similarity_score} >= 0 and ${table.similarity_score} <= 1`,
    ),
    check(
      "muscle_overlap_percentage_range",
      sql`${table.muscle_overlap_percentage} >= 0 and ${table.muscle_overlap_percentage} <= 100`,
    ),
    check(
      "difficulty_difference_range",
      sql`${table.difficulty_difference} >= -5 and ${table.difficulty_difference} <= 5`,
    ),
    check(
      "not_self_substitute",
      sql`${table.primary_exercise_id} != ${table.substitute_exercise_id}`,
    ),
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
    isWarmup: boolean().notNull().default(false),
    rpe: doublePrecision(),
    reportedRir: text("reported_rir", {
      enum: reportedRirValues,
    }),
    ...timestampColumns(),
  },
  (table) => [
    primaryKey({ columns: [table.workout, table.exercise, table.set] }),
    foreignKey({
      columns: [table.workout, table.exercise],
      foreignColumns: [
        workoutExercises.workout_id,
        workoutExercises.exercise_id,
      ],
    }),
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
    check(
      "rpe_range",
      sql`${table.rpe} is null or (${table.rpe} >= 6 and ${table.rpe} <= 10)`,
    ),
    // Changing reportedRirValues also requires a database constraint migration.
    check(
      "reported_rir_valid",
      sql`${table.reportedRir} is null or (${table.reportedRir} in ('0', '1', '2', '3', '4+', 'unsure') and ${table.isCompleted} and not ${table.isWarmup})`,
    ),
  ],
);

// AI Workout Generation
export const trainingPreferences = pgTable("training_preferences", {
  id: uuid().primaryKey().defaultRandom(),
  content: text().notNull(),
  source: text().notNull().default("refinement"),
  ...timestampColumns(),
});

export const generationConversations = pgTable("generation_conversations", {
  id: uuid().primaryKey().defaultRandom(),
  workout_id: uuid().references(() => workouts.id),
  messages: jsonb().notNull().default([]),
  context_snapshot: jsonb().notNull(),
  model: text().notNull(),
  total_tokens: integer().notNull().default(0),
  ...timestampColumns(),
});

// Nutrition
export const ingredientCategory = pgEnum(
  "ingredient_category",
  ingredientCategories,
);
export const textureCategory = pgEnum("texture_category", textureCategories);
export const mealCategory = pgEnum("meal_category", mealCategories);

export const ingredients = pgTable(
  "ingredients",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id),
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull(),
    category: ingredientCategory().notNull(),
    calories: doublePrecision().notNull(),
    protein: doublePrecision().notNull(),
    carbs: doublePrecision().notNull(),
    fat: doublePrecision().notNull(),
    fiber: doublePrecision().notNull(),
    water_percentage: doublePrecision().notNull(),
    energy_density: doublePrecision().notNull(),
    texture: textureCategory().notNull(),
    is_vegetarian: boolean().notNull().default(false),
    is_vegan: boolean().notNull().default(false),
    slider_min: integer().notNull(),
    slider_max: integer().notNull(),
    ai_generated: boolean().notNull().default(false),
    ai_generated_at: timestamp(),
    ...timestampColumns(),
  },
  (table) => [
    uniqueIndex("ingredients_user_id_id_unique_idx").on(table.userId, table.id),
    uniqueIndex("ingredients_name_unique_idx")
      .on(table.userId, table.name)
      .where(isNull(table.deleted_at)),
    uniqueIndex("ingredients_name_simple_unique_idx").on(
      table.userId,
      table.name,
    ),
    check("calories_positive", sql`${table.calories} >= 0`),
    check(
      "macros_positive",
      sql`${table.protein} >= 0 and ${table.carbs} >= 0 and ${table.fat} >= 0 and ${table.fiber} >= 0`,
    ),
    check(
      "water_percentage_range",
      sql`${table.water_percentage} >= 0 and ${table.water_percentage} <= 100`,
    ),
    check("energy_density_positive", sql`${table.energy_density} >= 0`),
    check(
      "slider_range_valid",
      sql`${table.slider_min} > 0 and ${table.slider_max} > ${table.slider_min}`,
    ),
  ],
);

export const mealTemplates = pgTable(
  "meal_templates",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id),
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull(),
    categories: mealCategory().array().notNull(),
    notes: text(),
    total_calories: doublePrecision().notNull(),
    total_protein: doublePrecision().notNull(),
    total_carbs: doublePrecision().notNull(),
    total_fat: doublePrecision().notNull(),
    total_fiber: doublePrecision().notNull(),
    satiety_score: doublePrecision().notNull(),
    usage_count: integer().notNull().default(0),
    is_public: boolean().notNull().default(false),
    ...timestampColumns(),
  },
  (table) => [
    uniqueIndex("meal_templates_user_id_id_unique_idx").on(
      table.userId,
      table.id,
    ),
    check(
      "meal_assignments_valid",
      sql`cardinality(${table.categories}) between 1 and 4 and array_position(${table.categories}, null) is null and cardinality(${table.categories}) = (('breakfast' = any(${table.categories}))::int + ('lunch' = any(${table.categories}))::int + ('dinner' = any(${table.categories}))::int + ('snack' = any(${table.categories}))::int)`,
    ),
  ],
);

export const mealTemplateIngredients = pgTable(
  "meal_template_ingredients",
  {
    userId: uuid("user_id").notNull(),
    meal_template_id: uuid()
      .references(() => mealTemplates.id)
      .notNull(),
    ingredient_id: uuid()
      .references(() => ingredients.id)
      .notNull(),
    quantity_grams: doublePrecision().notNull(),
    ...timestampColumns(),
  },
  (table) => [
    foreignKey({
      name: "meal_template_ingredients_owner_parent_fk",
      columns: [table.userId, table.meal_template_id],
      foreignColumns: [mealTemplates.userId, mealTemplates.id],
    }),
    foreignKey({
      name: "meal_template_ingredients_owner_ingredient_fk",
      columns: [table.userId, table.ingredient_id],
      foreignColumns: [ingredients.userId, ingredients.id],
    }),
    primaryKey({ columns: [table.meal_template_id, table.ingredient_id] }),
    check("quantity_positive", sql`${table.quantity_grams} > 0`),
  ],
);

export const mealLogs = pgTable(
  "meal_logs",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id),
    id: uuid().primaryKey().defaultRandom(),
    meal_category: mealCategory().notNull(),
    logged_date: date().notNull(),
    is_completed: boolean().notNull().default(false),
    notes: text(),
    meal_template_id: uuid().references(() => mealTemplates.id),
    ...timestampColumns(),
  },
  (table) => [
    foreignKey({
      name: "meal_logs_owner_template_fk",
      columns: [table.userId, table.meal_template_id],
      foreignColumns: [mealTemplates.userId, mealTemplates.id],
    }),
    uniqueIndex("meal_logs_user_id_id_unique_idx").on(table.userId, table.id),
    uniqueIndex("meal_logs_category_date_unique_idx")
      .on(table.userId, table.meal_category, table.logged_date)
      .where(isNull(table.deleted_at)),
  ],
);

export const mealLogIngredients = pgTable(
  "meal_log_ingredients",
  {
    userId: uuid("user_id").notNull(),
    meal_log_id: uuid()
      .references(() => mealLogs.id)
      .notNull(),
    ingredient_id: uuid()
      .references(() => ingredients.id)
      .notNull(),
    quantity_grams: doublePrecision().notNull(),
    ...timestampColumns(),
  },
  (table) => [
    foreignKey({
      name: "meal_log_ingredients_owner_parent_fk",
      columns: [table.userId, table.meal_log_id],
      foreignColumns: [mealLogs.userId, mealLogs.id],
    }),
    foreignKey({
      name: "meal_log_ingredients_owner_ingredient_fk",
      columns: [table.userId, table.ingredient_id],
      foreignColumns: [ingredients.userId, ingredients.id],
    }),
    primaryKey({ columns: [table.meal_log_id, table.ingredient_id] }),
    check("quantity_positive", sql`${table.quantity_grams} > 0`),
  ],
);

export const daily_note = pgTable(
  "daily_note",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id),
    id: integer().notNull().default(1),
    content: text().notNull().default(""),
    updated_at: timestamp(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.id] })],
);

export {
  oauthCodes,
  oauthConnections,
  oauthTokens,
} from "~/modules/auth/infra/schema";
