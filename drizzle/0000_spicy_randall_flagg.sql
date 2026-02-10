CREATE TYPE "public"."exercise_type" AS ENUM('barbell', 'bodyweight', 'cable', 'dumbbells', 'machine');--> statement-breakpoint
CREATE TYPE "public"."ingredient_category" AS ENUM('proteins', 'grains', 'vegetables', 'fruits', 'dairy', 'fats_oils', 'nuts_seeds', 'legumes', 'herbs_spices', 'condiments', 'beverages', 'sweeteners', 'other');--> statement-breakpoint
CREATE TYPE "public"."meal_category" AS ENUM('breakfast', 'lunch', 'dinner', 'snack');--> statement-breakpoint
CREATE TYPE "public"."movement_pattern" AS ENUM('push', 'pull', 'squat', 'hinge', 'core', 'isolation', 'rotation', 'gait');--> statement-breakpoint
CREATE TYPE "public"."muscle_group" AS ENUM('abs', 'armstrings', 'biceps', 'calves', 'delts', 'forearm', 'glutes', 'lats', 'lower_back', 'pecs', 'quads', 'trapezes', 'triceps');--> statement-breakpoint
CREATE TYPE "public"."texture_category" AS ENUM('liquid', 'semi_liquid', 'soft_solid', 'firm_solid', 'powder');--> statement-breakpoint
CREATE TABLE "equipment_instances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exercise_type" "exercise_type" NOT NULL,
	"gym_floor_id" uuid NOT NULL,
	"name" text NOT NULL,
	"capacity" integer DEFAULT 1 NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	"deleted_at" timestamp,
	CONSTRAINT "capacity_positive" CHECK ("equipment_instances"."capacity" > 0)
);
--> statement-breakpoint
CREATE TABLE "equipment_preferences" (
	"muscle_group" "muscle_group" NOT NULL,
	"exercise_type" "exercise_type" NOT NULL,
	"preference_score" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	"deleted_at" timestamp,
	CONSTRAINT "equipment_preferences_muscle_group_exercise_type_pk" PRIMARY KEY("muscle_group","exercise_type"),
	CONSTRAINT "preference_score_range" CHECK ("equipment_preferences"."preference_score" >= 1 and "equipment_preferences"."preference_score" <= 10)
);
--> statement-breakpoint
CREATE TABLE "exercise_muscle_groups" (
	"exercise" uuid NOT NULL,
	"muscle_group" "muscle_group" NOT NULL,
	"split" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	"deleted_at" timestamp,
	CONSTRAINT "exercise_muscle_groups_exercise_muscle_group_pk" PRIMARY KEY("exercise","muscle_group"),
	CONSTRAINT "split_is_percentage" CHECK ("exercise_muscle_groups"."split" > 0 and "exercise_muscle_groups"."split" <= 100)
);
--> statement-breakpoint
CREATE TABLE "exercise_substitutions" (
	"primary_exercise_id" uuid NOT NULL,
	"substitute_exercise_id" uuid NOT NULL,
	"similarity_score" double precision NOT NULL,
	"muscle_overlap_percentage" integer NOT NULL,
	"difficulty_difference" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	"deleted_at" timestamp,
	CONSTRAINT "exercise_substitutions_primary_exercise_id_substitute_exercise_id_pk" PRIMARY KEY("primary_exercise_id","substitute_exercise_id"),
	CONSTRAINT "similarity_score_range" CHECK ("exercise_substitutions"."similarity_score" >= 0 and "exercise_substitutions"."similarity_score" <= 1),
	CONSTRAINT "muscle_overlap_percentage_range" CHECK ("exercise_substitutions"."muscle_overlap_percentage" >= 0 and "exercise_substitutions"."muscle_overlap_percentage" <= 100),
	CONSTRAINT "difficulty_difference_range" CHECK ("exercise_substitutions"."difficulty_difference" >= -5 and "exercise_substitutions"."difficulty_difference" <= 5),
	CONSTRAINT "not_self_substitute" CHECK ("exercise_substitutions"."primary_exercise_id" != "exercise_substitutions"."substitute_exercise_id")
);
--> statement-breakpoint
CREATE TABLE "exercises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"mmc_instructions" text,
	"type" "exercise_type" NOT NULL,
	"movement_pattern" "movement_pattern" NOT NULL,
	"setup_time_seconds" integer DEFAULT 30 NOT NULL,
	"complexity_score" integer DEFAULT 1 NOT NULL,
	"equipment_sharing_friendly" boolean DEFAULT false NOT NULL,
	"requires_spotter" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	"deleted_at" timestamp,
	CONSTRAINT "setup_time_positive" CHECK ("exercises"."setup_time_seconds" >= 0),
	CONSTRAINT "complexity_score_range" CHECK ("exercises"."complexity_score" >= 1 and "exercises"."complexity_score" <= 5)
);
--> statement-breakpoint
CREATE TABLE "gym_floors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"floor_number" integer NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	"deleted_at" timestamp,
	CONSTRAINT "floor_number_positive" CHECK ("gym_floors"."floor_number" > 0)
);
--> statement-breakpoint
CREATE TABLE "habit_completions" (
	"habit_id" uuid NOT NULL,
	"completion_date" date NOT NULL,
	"completed" boolean NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	"deleted_at" timestamp,
	CONSTRAINT "habit_completions_habit_id_completion_date_pk" PRIMARY KEY("habit_id","completion_date")
);
--> statement-breakpoint
CREATE TABLE "habits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"frequency_type" text NOT NULL,
	"frequency_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"target_count" integer DEFAULT 1 NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "ingredients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"category" "ingredient_category" NOT NULL,
	"calories" double precision NOT NULL,
	"protein" double precision NOT NULL,
	"carbs" double precision NOT NULL,
	"fat" double precision NOT NULL,
	"fiber" double precision NOT NULL,
	"water_percentage" double precision NOT NULL,
	"energy_density" double precision NOT NULL,
	"texture" texture_category NOT NULL,
	"is_vegetarian" boolean DEFAULT false NOT NULL,
	"is_vegan" boolean DEFAULT false NOT NULL,
	"slider_min" integer NOT NULL,
	"slider_max" integer NOT NULL,
	"ai_generated" boolean DEFAULT false NOT NULL,
	"ai_generated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	"deleted_at" timestamp,
	CONSTRAINT "calories_positive" CHECK ("ingredients"."calories" >= 0),
	CONSTRAINT "macros_positive" CHECK ("ingredients"."protein" >= 0 and "ingredients"."carbs" >= 0 and "ingredients"."fat" >= 0 and "ingredients"."fiber" >= 0),
	CONSTRAINT "water_percentage_range" CHECK ("ingredients"."water_percentage" >= 0 and "ingredients"."water_percentage" <= 100),
	CONSTRAINT "energy_density_positive" CHECK ("ingredients"."energy_density" >= 0),
	CONSTRAINT "slider_range_valid" CHECK ("ingredients"."slider_min" > 0 and "ingredients"."slider_max" > "ingredients"."slider_min")
);
--> statement-breakpoint
CREATE TABLE "meal_log_ingredients" (
	"meal_log_id" uuid NOT NULL,
	"ingredient_id" uuid NOT NULL,
	"quantity_grams" double precision NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	"deleted_at" timestamp,
	CONSTRAINT "meal_log_ingredients_meal_log_id_ingredient_id_pk" PRIMARY KEY("meal_log_id","ingredient_id"),
	CONSTRAINT "quantity_positive" CHECK ("meal_log_ingredients"."quantity_grams" > 0)
);
--> statement-breakpoint
CREATE TABLE "meal_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meal_category" "meal_category" NOT NULL,
	"logged_date" date NOT NULL,
	"is_completed" boolean DEFAULT false NOT NULL,
	"notes" text,
	"meal_template_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "meal_template_ingredients" (
	"meal_template_id" uuid NOT NULL,
	"ingredient_id" uuid NOT NULL,
	"quantity_grams" double precision NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	"deleted_at" timestamp,
	CONSTRAINT "meal_template_ingredients_meal_template_id_ingredient_id_pk" PRIMARY KEY("meal_template_id","ingredient_id"),
	CONSTRAINT "quantity_positive" CHECK ("meal_template_ingredients"."quantity_grams" > 0)
);
--> statement-breakpoint
CREATE TABLE "meal_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"category" "meal_category" NOT NULL,
	"notes" text,
	"total_calories" double precision NOT NULL,
	"total_protein" double precision NOT NULL,
	"total_carbs" double precision NOT NULL,
	"total_fat" double precision NOT NULL,
	"total_fiber" double precision NOT NULL,
	"satiety_score" double precision NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "measurements" (
	"name" text PRIMARY KEY NOT NULL,
	"unit" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "measures" (
	"measurement_name" text NOT NULL,
	"t" timestamp DEFAULT now() NOT NULL,
	"value" double precision NOT NULL,
	CONSTRAINT "measures_measurement_name_t_pk" PRIMARY KEY("measurement_name","t")
);
--> statement-breakpoint
CREATE TABLE "targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"measurement_name" text NOT NULL,
	"value" double precision NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "workout_exercises" (
	"workout_id" uuid NOT NULL,
	"exercise_id" uuid NOT NULL,
	"order_index" integer NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	"deleted_at" timestamp,
	CONSTRAINT "workout_exercises_workout_id_exercise_id_pk" PRIMARY KEY("workout_id","exercise_id"),
	CONSTRAINT "order_index_positive" CHECK ("workout_exercises"."order_index" >= 0)
);
--> statement-breakpoint
CREATE TABLE "workout_sets" (
	"workout" uuid NOT NULL,
	"exercise" uuid NOT NULL,
	"set" integer NOT NULL,
	"targetReps" integer,
	"reps" integer,
	"weight" double precision,
	"note" text,
	"isCompleted" boolean DEFAULT false NOT NULL,
	"isFailure" boolean DEFAULT false NOT NULL,
	"isWarmup" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	"deleted_at" timestamp,
	CONSTRAINT "workout_sets_workout_exercise_set_pk" PRIMARY KEY("workout","exercise","set"),
	CONSTRAINT "set_is_positive" CHECK ("workout_sets"."set" > 0),
	CONSTRAINT "target_reps_is_null_or_positive" CHECK ("workout_sets"."targetReps" is null or "workout_sets"."targetReps" > 0),
	CONSTRAINT "reps_is_null_or_positive" CHECK ("workout_sets"."reps" is null or "workout_sets"."reps" > 0),
	CONSTRAINT "weight_is_null_or_positive" CHECK ("workout_sets"."weight" is null or "workout_sets"."weight" > 0)
);
--> statement-breakpoint
CREATE TABLE "workout_template_exercises" (
	"template_id" uuid NOT NULL,
	"exercise_id" uuid NOT NULL,
	"order_index" integer NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	"deleted_at" timestamp,
	CONSTRAINT "workout_template_exercises_template_id_exercise_id_pk" PRIMARY KEY("template_id","exercise_id"),
	CONSTRAINT "template_order_index_positive" CHECK ("workout_template_exercises"."order_index" >= 0)
);
--> statement-breakpoint
CREATE TABLE "workout_template_sets" (
	"template_id" uuid NOT NULL,
	"exercise_id" uuid NOT NULL,
	"set" integer NOT NULL,
	"target_reps" integer,
	"weight" double precision,
	"is_warmup" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	"deleted_at" timestamp,
	CONSTRAINT "workout_template_sets_template_id_exercise_id_set_pk" PRIMARY KEY("template_id","exercise_id","set"),
	CONSTRAINT "template_set_is_positive" CHECK ("workout_template_sets"."set" > 0)
);
--> statement-breakpoint
CREATE TABLE "workout_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"source_workout_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "workouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"start" timestamp DEFAULT now(),
	"stop" timestamp,
	"notes" text,
	"imported_from_strong" boolean DEFAULT false NOT NULL,
	"imported_from_fitbod" boolean DEFAULT false NOT NULL,
	"template_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	"deleted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "equipment_instances" ADD CONSTRAINT "equipment_instances_gym_floor_id_gym_floors_id_fk" FOREIGN KEY ("gym_floor_id") REFERENCES "public"."gym_floors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_muscle_groups" ADD CONSTRAINT "exercise_muscle_groups_exercise_exercises_id_fk" FOREIGN KEY ("exercise") REFERENCES "public"."exercises"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_substitutions" ADD CONSTRAINT "exercise_substitutions_primary_exercise_id_exercises_id_fk" FOREIGN KEY ("primary_exercise_id") REFERENCES "public"."exercises"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_substitutions" ADD CONSTRAINT "exercise_substitutions_substitute_exercise_id_exercises_id_fk" FOREIGN KEY ("substitute_exercise_id") REFERENCES "public"."exercises"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habit_completions" ADD CONSTRAINT "habit_completions_habit_id_habits_id_fk" FOREIGN KEY ("habit_id") REFERENCES "public"."habits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_log_ingredients" ADD CONSTRAINT "meal_log_ingredients_meal_log_id_meal_logs_id_fk" FOREIGN KEY ("meal_log_id") REFERENCES "public"."meal_logs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_log_ingredients" ADD CONSTRAINT "meal_log_ingredients_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_logs" ADD CONSTRAINT "meal_logs_meal_template_id_meal_templates_id_fk" FOREIGN KEY ("meal_template_id") REFERENCES "public"."meal_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_template_ingredients" ADD CONSTRAINT "meal_template_ingredients_meal_template_id_meal_templates_id_fk" FOREIGN KEY ("meal_template_id") REFERENCES "public"."meal_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_template_ingredients" ADD CONSTRAINT "meal_template_ingredients_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measures" ADD CONSTRAINT "measures_measurement_name_measurements_name_fk" FOREIGN KEY ("measurement_name") REFERENCES "public"."measurements"("name") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "targets" ADD CONSTRAINT "targets_measurement_name_measurements_name_fk" FOREIGN KEY ("measurement_name") REFERENCES "public"."measurements"("name") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_exercises" ADD CONSTRAINT "workout_exercises_workout_id_workouts_id_fk" FOREIGN KEY ("workout_id") REFERENCES "public"."workouts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_exercises" ADD CONSTRAINT "workout_exercises_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_sets" ADD CONSTRAINT "workout_sets_workout_workouts_id_fk" FOREIGN KEY ("workout") REFERENCES "public"."workouts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_sets" ADD CONSTRAINT "workout_sets_exercise_exercises_id_fk" FOREIGN KEY ("exercise") REFERENCES "public"."exercises"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_template_exercises" ADD CONSTRAINT "workout_template_exercises_template_id_workout_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."workout_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_template_exercises" ADD CONSTRAINT "workout_template_exercises_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_template_sets" ADD CONSTRAINT "workout_template_sets_template_id_workout_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."workout_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_template_sets" ADD CONSTRAINT "workout_template_sets_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_template_id_workout_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."workout_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "equipment_instances_name_floor_unique_idx" ON "equipment_instances" USING btree ("name","gym_floor_id") WHERE "equipment_instances"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "exercises_name_type_unique_idx" ON "exercises" USING btree ("name","type") WHERE "exercises"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "gym_floors_number_unique_idx" ON "gym_floors" USING btree ("floor_number") WHERE "gym_floors"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "ingredients_name_unique_idx" ON "ingredients" USING btree ("name") WHERE "ingredients"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "ingredients_name_simple_unique_idx" ON "ingredients" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "meal_logs_category_date_unique_idx" ON "meal_logs" USING btree ("meal_category","logged_date") WHERE "meal_logs"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_targets_measurement_active" ON "targets" USING btree ("measurement_name") WHERE "targets"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "workout_exercises_active_unique_idx" ON "workout_exercises" USING btree ("workout_id","exercise_id") WHERE "workout_exercises"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "workout_exercises_order_unique_idx" ON "workout_exercises" USING btree ("workout_id","order_index") WHERE "workout_exercises"."deleted_at" is null;