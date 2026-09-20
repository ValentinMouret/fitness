import {
  exerciseTypes,
  movementPatterns,
  muscleGroups,
} from "~/modules/fitness/domain/workout";
import { allowedFunctions, queryLimits } from "../domain/query-policy";

export const schemaDescription = {
  schema: "fitness_data",
  dialect: "PostgreSQL",
  conventions: [
    "Only the listed views are exposed. All views exclude soft-deleted records and their deleted parents.",
    "Identifiers are UUIDs. Exercises are catalogue entries; workout_exercises links one catalogue exercise to one workout. An exercise can occur once per workout.",
    "Timestamps represent UTC instants. Use ISO dates and explicit timezone conversion when grouping by local day. A null stop means the workout is ongoing.",
    "Weights are kilograms. Null performance means unknown/unrecorded, not zero. Uncompleted sets may contain suggested values; only is_completed records performed sets.",
    "Sets are identified by (workout_id, exercise_id, set_number). target_reps is planned; reps is recorded/suggested according to is_completed. RPE ranges from 6 to 10.",
    "Muscle contribution_percent is 1–100, totalling 100 per exercise. Splits reflect the current catalogue, not a historical snapshot.",
    "Working sets are completed, non-warm-up sets. volume_kg is reps × weight for working sets with known performance, otherwise zero. Bodyweight is not imputed.",
    "muscle_volume has one row per working set and muscle contribution. weighted_sets = contribution_percent / 100; volume_kg = set volume × contribution_percent / 100. Includes completed sets in ongoing workouts.",
    "Queries may filter, join, aggregate, use CTEs and windows. Functions are restricted to the listed built-ins. Use built-in casts and ordinary operators.",
    "Results contain rows, rowCount, and truncated. If truncated is true, narrow the query or use aggregates; an empty result may still be truncated if its first row exceeds the byte limit.",
  ],
  views: {
    workouts: {
      primaryKey: ["id"],
      columns: {
        id: "uuid",
        name: "text",
        start: "timestamptz nullable for legacy records",
        stop: "timestamptz nullable",
        notes: "text nullable",
      },
    },
    exercises: {
      primaryKey: ["id"],
      columns: {
        id: "uuid",
        name: "text",
        type: "text; equipment category",
        movement_pattern: "text",
        description: "text nullable",
        mmc_instructions: "text nullable; mind-muscle connection instructions",
      },
    },
    workout_exercises: {
      primaryKey: ["workout_id", "exercise_id"],
      columns: {
        workout_id: "uuid → workouts.id",
        exercise_id: "uuid → exercises.id",
        order_index: "integer; ascending session order",
        notes: "text nullable; session-specific notes",
      },
    },
    sets: {
      primaryKey: ["workout_id", "exercise_id", "set_number"],
      columns: {
        workout_id: "uuid → workouts.id",
        exercise_id: "uuid → exercises.id",
        set_number: "positive integer",
        target_reps: "positive integer nullable",
        reps: "positive integer nullable",
        weight_kg: "positive number nullable",
        note: "text nullable",
        is_completed: "boolean",
        is_warmup: "boolean",
        is_failure: "boolean",
        rpe: "number nullable",
        is_working_set: "boolean; completed and not warm-up",
        volume_kg: "number; working-set reps × weight_kg, zero when missing",
      },
    },
    exercise_muscles: {
      primaryKey: ["exercise_id", "muscle_group"],
      columns: {
        exercise_id: "uuid → exercises.id",
        muscle_group: "text",
        contribution_percent: "integer; percentage",
      },
    },
    muscle_volume: {
      primaryKey: ["workout_id", "exercise_id", "set_number", "muscle_group"],
      columns: {
        workout_id: "uuid → workouts.id",
        exercise_id: "uuid → exercises.id",
        set_number: "integer → sets.set_number with workout and exercise",
        start: "timestamptz; workout start",
        muscle_group: "text",
        weighted_sets: "number; fractional working-set contribution",
        volume_kg: "number; muscle-weighted reps × kg",
      },
    },
  },
  enums: { exerciseTypes, movementPatterns, muscleGroups },
  limits: queryLimits,
  allowedFunctions,
  examples: [
    "select id, name, type from fitness_data.exercises where name ilike '%press%' order by name",
    "select * from fitness_data.workouts where stop is null order by start desc",
    "select date_trunc('week', start) as week, muscle_group, sum(weighted_sets) as sets, sum(volume_kg) as volume_kg from fitness_data.muscle_volume where start >= now() - interval '12 weeks' group by 1, 2 order by 1, 2",
  ],
} as const;
