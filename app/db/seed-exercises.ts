import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import type { InferInsertModel } from "drizzle-orm";
import {
  exercises,
  exerciseMuscleGroups,
  exerciseSubstitutions,
  equipmentPreferences,
} from "./schema";
import type { MuscleGroup } from "~/modules/fitness/domain/workout";

export const db = drizzle({
  connection: {
    connectionString: process.env.DATABASE_URL ?? "",
  },
});

const exerciseData: Omit<InferInsertModel<typeof exercises>, "id">[] = [
  // PUSH EXERCISES
  // Chest - Horizontal Push
  {
    name: "Bench Press",
    type: "barbell",
    movement_pattern: "push",
    setup_time_seconds: 60,
    complexity_score: 3,
    requires_spotter: true,
  },
  {
    name: "Incline Bench Press",
    type: "barbell",
    movement_pattern: "push",
    setup_time_seconds: 60,
    complexity_score: 3,
    requires_spotter: true,
  },
  {
    name: "Dumbbell Bench Press",
    type: "dumbbells",
    movement_pattern: "push",
    setup_time_seconds: 30,
    complexity_score: 2,
  },
  {
    name: "Incline Dumbbell Press",
    type: "dumbbells",
    movement_pattern: "push",
    setup_time_seconds: 30,
    complexity_score: 2,
  },
  {
    name: "Chest Press Machine",
    type: "machine",
    movement_pattern: "push",
    setup_time_seconds: 15,
    complexity_score: 1,
  },
  {
    name: "Cable Chest Press",
    type: "cable",
    movement_pattern: "push",
    setup_time_seconds: 20,
    complexity_score: 2,
  },
  {
    name: "Push-ups",
    type: "bodyweight",
    movement_pattern: "push",
    setup_time_seconds: 5,
    complexity_score: 1,
  },

  // Shoulders - Vertical Push
  {
    name: "Overhead Press",
    type: "barbell",
    movement_pattern: "push",
    setup_time_seconds: 45,
    complexity_score: 4,
    requires_spotter: true,
  },
  {
    name: "Dumbbell Shoulder Press",
    type: "dumbbells",
    movement_pattern: "push",
    setup_time_seconds: 20,
    complexity_score: 2,
  },
  {
    name: "Seated Shoulder Press Machine",
    type: "machine",
    movement_pattern: "push",
    setup_time_seconds: 15,
    complexity_score: 1,
  },
  {
    name: "Cable Shoulder Press",
    type: "cable",
    movement_pattern: "push",
    setup_time_seconds: 25,
    complexity_score: 2,
  },

  // PULL EXERCISES
  // Back - Horizontal Pull
  {
    name: "Barbell Row",
    type: "barbell",
    movement_pattern: "pull",
    setup_time_seconds: 45,
    complexity_score: 3,
  },
  {
    name: "Dumbbell Row",
    type: "dumbbells",
    movement_pattern: "pull",
    setup_time_seconds: 20,
    complexity_score: 2,
  },
  {
    name: "Cable Row",
    type: "cable",
    movement_pattern: "pull",
    setup_time_seconds: 20,
    complexity_score: 2,
    equipment_sharing_friendly: true,
  },
  {
    name: "Chest Supported Row",
    type: "machine",
    movement_pattern: "pull",
    setup_time_seconds: 15,
    complexity_score: 1,
  },
  {
    name: "T-Bar Row",
    type: "barbell",
    movement_pattern: "pull",
    setup_time_seconds: 30,
    complexity_score: 3,
  },

  // Back - Vertical Pull
  {
    name: "Pull-ups",
    type: "bodyweight",
    movement_pattern: "pull",
    setup_time_seconds: 10,
    complexity_score: 4,
  },
  {
    name: "Lat Pulldown",
    type: "cable",
    movement_pattern: "pull",
    setup_time_seconds: 15,
    complexity_score: 2,
    equipment_sharing_friendly: true,
  },
  {
    name: "Chin-ups",
    type: "bodyweight",
    movement_pattern: "pull",
    setup_time_seconds: 10,
    complexity_score: 4,
  },

  // SQUAT EXERCISES
  {
    name: "Back Squat",
    type: "barbell",
    movement_pattern: "squat",
    setup_time_seconds: 90,
    complexity_score: 4,
    requires_spotter: true,
  },
  {
    name: "Front Squat",
    type: "barbell",
    movement_pattern: "squat",
    setup_time_seconds: 60,
    complexity_score: 5,
  },
  {
    name: "Goblet Squat",
    type: "dumbbells",
    movement_pattern: "squat",
    setup_time_seconds: 15,
    complexity_score: 2,
  },
  {
    name: "Leg Press",
    type: "machine",
    movement_pattern: "squat",
    setup_time_seconds: 20,
    complexity_score: 1,
    equipment_sharing_friendly: true,
  },
  {
    name: "Hack Squat",
    type: "machine",
    movement_pattern: "squat",
    setup_time_seconds: 20,
    complexity_score: 2,
  },
  {
    name: "Bulgarian Split Squat",
    type: "dumbbells",
    movement_pattern: "squat",
    setup_time_seconds: 20,
    complexity_score: 3,
  },
  {
    name: "Bodyweight Squat",
    type: "bodyweight",
    movement_pattern: "squat",
    setup_time_seconds: 5,
    complexity_score: 1,
  },

  // HINGE EXERCISES
  {
    name: "Deadlift",
    type: "barbell",
    movement_pattern: "hinge",
    setup_time_seconds: 60,
    complexity_score: 5,
  },
  {
    name: "Romanian Deadlift",
    type: "barbell",
    movement_pattern: "hinge",
    setup_time_seconds: 45,
    complexity_score: 3,
  },
  {
    name: "Dumbbell Romanian Deadlift",
    type: "dumbbells",
    movement_pattern: "hinge",
    setup_time_seconds: 20,
    complexity_score: 2,
  },
  {
    name: "Hip Thrust",
    type: "barbell",
    movement_pattern: "hinge",
    setup_time_seconds: 45,
    complexity_score: 2,
  },
  {
    name: "Cable Pull Through",
    type: "cable",
    movement_pattern: "hinge",
    setup_time_seconds: 15,
    complexity_score: 2,
  },
  {
    name: "Leg Curl",
    type: "machine",
    movement_pattern: "hinge",
    setup_time_seconds: 15,
    complexity_score: 1,
  },

  // ISOLATION EXERCISES
  // Arms
  {
    name: "Barbell Curl",
    type: "barbell",
    movement_pattern: "isolation",
    setup_time_seconds: 20,
    complexity_score: 1,
  },
  {
    name: "Dumbbell Curl",
    type: "dumbbells",
    movement_pattern: "isolation",
    setup_time_seconds: 15,
    complexity_score: 1,
  },
  {
    name: "Cable Curl",
    type: "cable",
    movement_pattern: "isolation",
    setup_time_seconds: 15,
    complexity_score: 1,
    equipment_sharing_friendly: true,
  },
  {
    name: "Tricep Dips",
    type: "bodyweight",
    movement_pattern: "isolation",
    setup_time_seconds: 10,
    complexity_score: 2,
  },
  {
    name: "Tricep Pushdown",
    type: "cable",
    movement_pattern: "isolation",
    setup_time_seconds: 15,
    complexity_score: 1,
    equipment_sharing_friendly: true,
  },
  {
    name: "Overhead Tricep Extension",
    type: "dumbbells",
    movement_pattern: "isolation",
    setup_time_seconds: 15,
    complexity_score: 2,
  },

  // Shoulders
  {
    name: "Lateral Raise",
    type: "dumbbells",
    movement_pattern: "isolation",
    setup_time_seconds: 10,
    complexity_score: 1,
  },
  {
    name: "Cable Lateral Raise",
    type: "cable",
    movement_pattern: "isolation",
    setup_time_seconds: 15,
    complexity_score: 1,
    equipment_sharing_friendly: true,
  },
  {
    name: "Rear Delt Fly",
    type: "dumbbells",
    movement_pattern: "isolation",
    setup_time_seconds: 15,
    complexity_score: 1,
  },
  {
    name: "Cable Rear Delt Fly",
    type: "cable",
    movement_pattern: "isolation",
    setup_time_seconds: 15,
    complexity_score: 1,
    equipment_sharing_friendly: true,
  },
  {
    name: "Face Pull",
    type: "cable",
    movement_pattern: "isolation",
    setup_time_seconds: 15,
    complexity_score: 2,
    equipment_sharing_friendly: true,
  },

  // Legs
  {
    name: "Leg Extension",
    type: "machine",
    movement_pattern: "isolation",
    setup_time_seconds: 15,
    complexity_score: 1,
  },
  {
    name: "Calf Raise",
    type: "machine",
    movement_pattern: "isolation",
    setup_time_seconds: 15,
    complexity_score: 1,
  },

  // CORE EXERCISES
  {
    name: "Plank",
    type: "bodyweight",
    movement_pattern: "core",
    setup_time_seconds: 5,
    complexity_score: 1,
  },
  {
    name: "Dead Bug",
    type: "bodyweight",
    movement_pattern: "core",
    setup_time_seconds: 5,
    complexity_score: 2,
  },
  {
    name: "Bird Dog",
    type: "bodyweight",
    movement_pattern: "core",
    setup_time_seconds: 5,
    complexity_score: 2,
  },
  {
    name: "Ab Wheel",
    type: "bodyweight",
    movement_pattern: "core",
    setup_time_seconds: 10,
    complexity_score: 3,
  },
  {
    name: "Cable Crunch",
    type: "cable",
    movement_pattern: "core",
    setup_time_seconds: 15,
    complexity_score: 2,
    equipment_sharing_friendly: true,
  },
  {
    name: "Hanging Leg Raise",
    type: "bodyweight",
    movement_pattern: "core",
    setup_time_seconds: 10,
    complexity_score: 4,
  },
];

// Equipment preferences based on evidence-based hierarchy: Cables > Dumbbells > Barbells > Machines (except legs)
const equipmentPreferenceData: InferInsertModel<typeof equipmentPreferences>[] =
  [
    // Chest preferences
    { muscle_group: "pecs", exercise_type: "cable", preference_score: 10 },
    { muscle_group: "pecs", exercise_type: "dumbbells", preference_score: 9 },
    { muscle_group: "pecs", exercise_type: "barbell", preference_score: 8 },
    { muscle_group: "pecs", exercise_type: "machine", preference_score: 6 },
    { muscle_group: "pecs", exercise_type: "bodyweight", preference_score: 7 },

    // Back preferences
    { muscle_group: "lats", exercise_type: "cable", preference_score: 10 },
    { muscle_group: "lats", exercise_type: "dumbbells", preference_score: 9 },
    { muscle_group: "lats", exercise_type: "barbell", preference_score: 8 },
    { muscle_group: "lats", exercise_type: "machine", preference_score: 7 },
    { muscle_group: "lats", exercise_type: "bodyweight", preference_score: 9 },

    // Shoulders preferences
    { muscle_group: "delts", exercise_type: "cable", preference_score: 10 },
    { muscle_group: "delts", exercise_type: "dumbbells", preference_score: 9 },
    { muscle_group: "delts", exercise_type: "barbell", preference_score: 7 },
    { muscle_group: "delts", exercise_type: "machine", preference_score: 6 },
    { muscle_group: "delts", exercise_type: "bodyweight", preference_score: 5 },

    // Arms preferences
    { muscle_group: "biceps", exercise_type: "cable", preference_score: 10 },
    { muscle_group: "biceps", exercise_type: "dumbbells", preference_score: 9 },
    { muscle_group: "biceps", exercise_type: "barbell", preference_score: 8 },
    { muscle_group: "biceps", exercise_type: "machine", preference_score: 6 },
    {
      muscle_group: "biceps",
      exercise_type: "bodyweight",
      preference_score: 7,
    },

    { muscle_group: "triceps", exercise_type: "cable", preference_score: 10 },
    {
      muscle_group: "triceps",
      exercise_type: "dumbbells",
      preference_score: 9,
    },
    { muscle_group: "triceps", exercise_type: "barbell", preference_score: 7 },
    { muscle_group: "triceps", exercise_type: "machine", preference_score: 6 },
    {
      muscle_group: "triceps",
      exercise_type: "bodyweight",
      preference_score: 8,
    },

    // Legs preferences (machines preferred due to leverage advantages)
    { muscle_group: "quads", exercise_type: "machine", preference_score: 10 },
    { muscle_group: "quads", exercise_type: "barbell", preference_score: 9 },
    { muscle_group: "quads", exercise_type: "dumbbells", preference_score: 7 },
    { muscle_group: "quads", exercise_type: "cable", preference_score: 6 },
    { muscle_group: "quads", exercise_type: "bodyweight", preference_score: 5 },

    { muscle_group: "glutes", exercise_type: "barbell", preference_score: 10 },
    { muscle_group: "glutes", exercise_type: "machine", preference_score: 9 },
    { muscle_group: "glutes", exercise_type: "cable", preference_score: 8 },
    { muscle_group: "glutes", exercise_type: "dumbbells", preference_score: 7 },
    {
      muscle_group: "glutes",
      exercise_type: "bodyweight",
      preference_score: 6,
    },

    {
      muscle_group: "armstrings",
      exercise_type: "machine",
      preference_score: 10,
    },
    {
      muscle_group: "armstrings",
      exercise_type: "barbell",
      preference_score: 9,
    },
    {
      muscle_group: "armstrings",
      exercise_type: "dumbbells",
      preference_score: 8,
    },
    { muscle_group: "armstrings", exercise_type: "cable", preference_score: 7 },
    {
      muscle_group: "armstrings",
      exercise_type: "bodyweight",
      preference_score: 5,
    },

    { muscle_group: "calves", exercise_type: "machine", preference_score: 10 },
    { muscle_group: "calves", exercise_type: "dumbbells", preference_score: 7 },
    { muscle_group: "calves", exercise_type: "barbell", preference_score: 6 },
    { muscle_group: "calves", exercise_type: "cable", preference_score: 8 },
    {
      muscle_group: "calves",
      exercise_type: "bodyweight",
      preference_score: 5,
    },

    // Core preferences
    { muscle_group: "abs", exercise_type: "bodyweight", preference_score: 10 },
    { muscle_group: "abs", exercise_type: "cable", preference_score: 9 },
    { muscle_group: "abs", exercise_type: "machine", preference_score: 7 },
    { muscle_group: "abs", exercise_type: "dumbbells", preference_score: 6 },
    { muscle_group: "abs", exercise_type: "barbell", preference_score: 5 },

    // Other muscle groups
    { muscle_group: "trapezes", exercise_type: "cable", preference_score: 10 },
    {
      muscle_group: "trapezes",
      exercise_type: "dumbbells",
      preference_score: 9,
    },
    { muscle_group: "trapezes", exercise_type: "barbell", preference_score: 8 },
    { muscle_group: "trapezes", exercise_type: "machine", preference_score: 7 },
    {
      muscle_group: "trapezes",
      exercise_type: "bodyweight",
      preference_score: 6,
    },

    {
      muscle_group: "lower_back",
      exercise_type: "barbell",
      preference_score: 10,
    },
    { muscle_group: "lower_back", exercise_type: "cable", preference_score: 9 },
    {
      muscle_group: "lower_back",
      exercise_type: "machine",
      preference_score: 8,
    },
    {
      muscle_group: "lower_back",
      exercise_type: "dumbbells",
      preference_score: 7,
    },
    {
      muscle_group: "lower_back",
      exercise_type: "bodyweight",
      preference_score: 9,
    },

    { muscle_group: "forearm", exercise_type: "cable", preference_score: 10 },
    {
      muscle_group: "forearm",
      exercise_type: "dumbbells",
      preference_score: 9,
    },
    { muscle_group: "forearm", exercise_type: "barbell", preference_score: 8 },
    { muscle_group: "forearm", exercise_type: "machine", preference_score: 6 },
    {
      muscle_group: "forearm",
      exercise_type: "bodyweight",
      preference_score: 7,
    },
  ];

async function main() {
  console.log("Starting exercise database seeding...");

  await db.transaction(async (tx) => {
    console.log("Seeding exercises...");
    const insertedExercises = await tx
      .insert(exercises)
      .values(exerciseData)
      .returning();
    console.log(`Inserted ${insertedExercises.length} exercises`);

    console.log("Seeding equipment preferences...");
    await tx
      .insert(equipmentPreferences)
      .values(equipmentPreferenceData)
      .onConflictDoNothing();

    // Create muscle group relationships based on exercise names
    console.log("Seeding exercise muscle groups...");
    const muscleGroupMappings: Array<{
      exerciseName: string;
      muscleGroups: Array<{ muscle_group: MuscleGroup; split: number }>;
    }> = [
      // Chest exercises
      {
        exerciseName: "Bench Press",
        muscleGroups: [
          { muscle_group: "pecs", split: 70 },
          { muscle_group: "triceps", split: 20 },
          { muscle_group: "delts", split: 10 },
        ],
      },
      {
        exerciseName: "Incline Bench Press",
        muscleGroups: [
          { muscle_group: "pecs", split: 65 },
          { muscle_group: "delts", split: 25 },
          { muscle_group: "triceps", split: 10 },
        ],
      },
      {
        exerciseName: "Dumbbell Bench Press",
        muscleGroups: [
          { muscle_group: "pecs", split: 75 },
          { muscle_group: "triceps", split: 15 },
          { muscle_group: "delts", split: 10 },
        ],
      },
      {
        exerciseName: "Incline Dumbbell Press",
        muscleGroups: [
          { muscle_group: "pecs", split: 60 },
          { muscle_group: "delts", split: 30 },
          { muscle_group: "triceps", split: 10 },
        ],
      },
      {
        exerciseName: "Chest Press Machine",
        muscleGroups: [
          { muscle_group: "pecs", split: 80 },
          { muscle_group: "triceps", split: 15 },
          { muscle_group: "delts", split: 5 },
        ],
      },
      {
        exerciseName: "Cable Chest Press",
        muscleGroups: [
          { muscle_group: "pecs", split: 75 },
          { muscle_group: "triceps", split: 20 },
          { muscle_group: "delts", split: 5 },
        ],
      },
      {
        exerciseName: "Push-ups",
        muscleGroups: [
          { muscle_group: "pecs", split: 70 },
          { muscle_group: "triceps", split: 20 },
          { muscle_group: "delts", split: 10 },
        ],
      },

      // Shoulder exercises
      {
        exerciseName: "Overhead Press",
        muscleGroups: [
          { muscle_group: "delts", split: 70 },
          { muscle_group: "triceps", split: 20 },
          { muscle_group: "trapezes", split: 10 },
        ],
      },
      {
        exerciseName: "Dumbbell Shoulder Press",
        muscleGroups: [
          { muscle_group: "delts", split: 75 },
          { muscle_group: "triceps", split: 25 },
        ],
      },
      {
        exerciseName: "Seated Shoulder Press Machine",
        muscleGroups: [
          { muscle_group: "delts", split: 80 },
          { muscle_group: "triceps", split: 20 },
        ],
      },
      {
        exerciseName: "Cable Shoulder Press",
        muscleGroups: [
          { muscle_group: "delts", split: 75 },
          { muscle_group: "triceps", split: 25 },
        ],
      },

      // Back exercises
      {
        exerciseName: "Barbell Row",
        muscleGroups: [
          { muscle_group: "lats", split: 40 },
          { muscle_group: "trapezes", split: 30 },
          { muscle_group: "delts", split: 20 },
          { muscle_group: "biceps", split: 10 },
        ],
      },
      {
        exerciseName: "Dumbbell Row",
        muscleGroups: [
          { muscle_group: "lats", split: 45 },
          { muscle_group: "trapezes", split: 25 },
          { muscle_group: "delts", split: 20 },
          { muscle_group: "biceps", split: 10 },
        ],
      },
      {
        exerciseName: "Cable Row",
        muscleGroups: [
          { muscle_group: "lats", split: 40 },
          { muscle_group: "trapezes", split: 35 },
          { muscle_group: "delts", split: 15 },
          { muscle_group: "biceps", split: 10 },
        ],
      },
      {
        exerciseName: "Chest Supported Row",
        muscleGroups: [
          { muscle_group: "lats", split: 45 },
          { muscle_group: "trapezes", split: 35 },
          { muscle_group: "delts", split: 15 },
          { muscle_group: "biceps", split: 5 },
        ],
      },
      {
        exerciseName: "T-Bar Row",
        muscleGroups: [
          { muscle_group: "lats", split: 40 },
          { muscle_group: "trapezes", split: 35 },
          { muscle_group: "delts", split: 15 },
          { muscle_group: "biceps", split: 10 },
        ],
      },
      {
        exerciseName: "Pull-ups",
        muscleGroups: [
          { muscle_group: "lats", split: 60 },
          { muscle_group: "biceps", split: 25 },
          { muscle_group: "trapezes", split: 15 },
        ],
      },
      {
        exerciseName: "Lat Pulldown",
        muscleGroups: [
          { muscle_group: "lats", split: 65 },
          { muscle_group: "biceps", split: 20 },
          { muscle_group: "trapezes", split: 15 },
        ],
      },
      {
        exerciseName: "Chin-ups",
        muscleGroups: [
          { muscle_group: "lats", split: 55 },
          { muscle_group: "biceps", split: 35 },
          { muscle_group: "trapezes", split: 10 },
        ],
      },

      // Squat exercises
      {
        exerciseName: "Back Squat",
        muscleGroups: [
          { muscle_group: "quads", split: 60 },
          { muscle_group: "glutes", split: 30 },
          { muscle_group: "armstrings", split: 10 },
        ],
      },
      {
        exerciseName: "Front Squat",
        muscleGroups: [
          { muscle_group: "quads", split: 70 },
          { muscle_group: "glutes", split: 25 },
          { muscle_group: "abs", split: 5 },
        ],
      },
      {
        exerciseName: "Goblet Squat",
        muscleGroups: [
          { muscle_group: "quads", split: 65 },
          { muscle_group: "glutes", split: 35 },
        ],
      },
      {
        exerciseName: "Leg Press",
        muscleGroups: [
          { muscle_group: "quads", split: 70 },
          { muscle_group: "glutes", split: 30 },
        ],
      },
      {
        exerciseName: "Hack Squat",
        muscleGroups: [
          { muscle_group: "quads", split: 75 },
          { muscle_group: "glutes", split: 25 },
        ],
      },
      {
        exerciseName: "Bulgarian Split Squat",
        muscleGroups: [
          { muscle_group: "quads", split: 60 },
          { muscle_group: "glutes", split: 40 },
        ],
      },
      {
        exerciseName: "Bodyweight Squat",
        muscleGroups: [
          { muscle_group: "quads", split: 60 },
          { muscle_group: "glutes", split: 40 },
        ],
      },

      // Hinge exercises
      {
        exerciseName: "Deadlift",
        muscleGroups: [
          { muscle_group: "glutes", split: 35 },
          { muscle_group: "armstrings", split: 30 },
          { muscle_group: "lower_back", split: 20 },
          { muscle_group: "trapezes", split: 15 },
        ],
      },
      {
        exerciseName: "Romanian Deadlift",
        muscleGroups: [
          { muscle_group: "armstrings", split: 50 },
          { muscle_group: "glutes", split: 40 },
          { muscle_group: "lower_back", split: 10 },
        ],
      },
      {
        exerciseName: "Dumbbell Romanian Deadlift",
        muscleGroups: [
          { muscle_group: "armstrings", split: 55 },
          { muscle_group: "glutes", split: 45 },
        ],
      },
      {
        exerciseName: "Hip Thrust",
        muscleGroups: [
          { muscle_group: "glutes", split: 90 },
          { muscle_group: "armstrings", split: 10 },
        ],
      },
      {
        exerciseName: "Cable Pull Through",
        muscleGroups: [
          { muscle_group: "glutes", split: 70 },
          { muscle_group: "armstrings", split: 30 },
        ],
      },
      {
        exerciseName: "Leg Curl",
        muscleGroups: [{ muscle_group: "armstrings", split: 100 }],
      },

      // Isolation exercises
      {
        exerciseName: "Barbell Curl",
        muscleGroups: [
          { muscle_group: "biceps", split: 90 },
          { muscle_group: "forearm", split: 10 },
        ],
      },
      {
        exerciseName: "Dumbbell Curl",
        muscleGroups: [
          { muscle_group: "biceps", split: 90 },
          { muscle_group: "forearm", split: 10 },
        ],
      },
      {
        exerciseName: "Cable Curl",
        muscleGroups: [
          { muscle_group: "biceps", split: 95 },
          { muscle_group: "forearm", split: 5 },
        ],
      },
      {
        exerciseName: "Tricep Dips",
        muscleGroups: [
          { muscle_group: "triceps", split: 85 },
          { muscle_group: "pecs", split: 15 },
        ],
      },
      {
        exerciseName: "Tricep Pushdown",
        muscleGroups: [{ muscle_group: "triceps", split: 100 }],
      },
      {
        exerciseName: "Overhead Tricep Extension",
        muscleGroups: [{ muscle_group: "triceps", split: 100 }],
      },
      {
        exerciseName: "Lateral Raise",
        muscleGroups: [{ muscle_group: "delts", split: 100 }],
      },
      {
        exerciseName: "Cable Lateral Raise",
        muscleGroups: [{ muscle_group: "delts", split: 100 }],
      },
      {
        exerciseName: "Rear Delt Fly",
        muscleGroups: [{ muscle_group: "delts", split: 100 }],
      },
      {
        exerciseName: "Cable Rear Delt Fly",
        muscleGroups: [{ muscle_group: "delts", split: 100 }],
      },
      {
        exerciseName: "Face Pull",
        muscleGroups: [
          { muscle_group: "delts", split: 70 },
          { muscle_group: "trapezes", split: 30 },
        ],
      },
      {
        exerciseName: "Leg Extension",
        muscleGroups: [{ muscle_group: "quads", split: 100 }],
      },
      {
        exerciseName: "Calf Raise",
        muscleGroups: [{ muscle_group: "calves", split: 100 }],
      },

      // Core exercises
      {
        exerciseName: "Plank",
        muscleGroups: [{ muscle_group: "abs", split: 100 }],
      },
      {
        exerciseName: "Dead Bug",
        muscleGroups: [{ muscle_group: "abs", split: 100 }],
      },
      {
        exerciseName: "Bird Dog",
        muscleGroups: [
          { muscle_group: "abs", split: 80 },
          { muscle_group: "lower_back", split: 20 },
        ],
      },
      {
        exerciseName: "Ab Wheel",
        muscleGroups: [{ muscle_group: "abs", split: 100 }],
      },
      {
        exerciseName: "Cable Crunch",
        muscleGroups: [{ muscle_group: "abs", split: 100 }],
      },
      {
        exerciseName: "Hanging Leg Raise",
        muscleGroups: [{ muscle_group: "abs", split: 100 }],
      },
    ];

    // Insert muscle group relationships
    for (const mapping of muscleGroupMappings) {
      const exercise = insertedExercises.find(
        (e) => e.name === mapping.exerciseName,
      );
      if (exercise) {
        const muscleGroupData = mapping.muscleGroups.map((mg) => ({
          exercise: exercise.id,
          muscle_group: mg.muscle_group,
          split: mg.split,
        }));
        await tx
          .insert(exerciseMuscleGroups)
          .values(muscleGroupData)
          .onConflictDoNothing();
      }
    }

    // Create some basic substitutions based on similar movement patterns and equipment
    console.log("Seeding exercise substitutions...");
    const substitutionMappings: Array<{
      primary: string;
      substitute: string;
      similarity: number;
      overlap: number;
      difficulty: number;
    }> = [
      // Chest substitutions
      {
        primary: "Bench Press",
        substitute: "Dumbbell Bench Press",
        similarity: 0.9,
        overlap: 95,
        difficulty: -1,
      },
      {
        primary: "Bench Press",
        substitute: "Cable Chest Press",
        similarity: 0.85,
        overlap: 90,
        difficulty: -2,
      },
      {
        primary: "Dumbbell Bench Press",
        substitute: "Cable Chest Press",
        similarity: 0.88,
        overlap: 92,
        difficulty: 0,
      },
      {
        primary: "Incline Bench Press",
        substitute: "Incline Dumbbell Press",
        similarity: 0.92,
        overlap: 95,
        difficulty: -1,
      },

      // Shoulder substitutions
      {
        primary: "Overhead Press",
        substitute: "Dumbbell Shoulder Press",
        similarity: 0.9,
        overlap: 90,
        difficulty: -1,
      },
      {
        primary: "Dumbbell Shoulder Press",
        substitute: "Cable Shoulder Press",
        similarity: 0.88,
        overlap: 88,
        difficulty: 0,
      },

      // Back substitutions
      {
        primary: "Barbell Row",
        substitute: "Dumbbell Row",
        similarity: 0.9,
        overlap: 90,
        difficulty: -1,
      },
      {
        primary: "Barbell Row",
        substitute: "Cable Row",
        similarity: 0.88,
        overlap: 85,
        difficulty: -2,
      },
      {
        primary: "Pull-ups",
        substitute: "Lat Pulldown",
        similarity: 0.9,
        overlap: 90,
        difficulty: -2,
      },
      {
        primary: "Chin-ups",
        substitute: "Pull-ups",
        similarity: 0.85,
        overlap: 80,
        difficulty: 0,
      },

      // Squat substitutions
      {
        primary: "Back Squat",
        substitute: "Front Squat",
        similarity: 0.9,
        overlap: 85,
        difficulty: 1,
      },
      {
        primary: "Back Squat",
        substitute: "Leg Press",
        similarity: 0.8,
        overlap: 80,
        difficulty: -3,
      },
      {
        primary: "Leg Press",
        substitute: "Hack Squat",
        similarity: 0.9,
        overlap: 95,
        difficulty: 1,
      },

      // Hinge substitutions
      {
        primary: "Deadlift",
        substitute: "Romanian Deadlift",
        similarity: 0.85,
        overlap: 80,
        difficulty: -1,
      },
      {
        primary: "Romanian Deadlift",
        substitute: "Dumbbell Romanian Deadlift",
        similarity: 0.9,
        overlap: 95,
        difficulty: -1,
      },

      // Isolation substitutions
      {
        primary: "Barbell Curl",
        substitute: "Dumbbell Curl",
        similarity: 0.9,
        overlap: 95,
        difficulty: 0,
      },
      {
        primary: "Dumbbell Curl",
        substitute: "Cable Curl",
        similarity: 0.9,
        overlap: 95,
        difficulty: 0,
      },
      {
        primary: "Lateral Raise",
        substitute: "Cable Lateral Raise",
        similarity: 0.95,
        overlap: 98,
        difficulty: 0,
      },
    ];

    for (const sub of substitutionMappings) {
      const primaryExercise = insertedExercises.find(
        (e) => e.name === sub.primary,
      );
      const substituteExercise = insertedExercises.find(
        (e) => e.name === sub.substitute,
      );

      if (primaryExercise && substituteExercise) {
        await tx
          .insert(exerciseSubstitutions)
          .values({
            primary_exercise_id: primaryExercise.id,
            substitute_exercise_id: substituteExercise.id,
            similarity_score: sub.similarity,
            muscle_overlap_percentage: sub.overlap,
            difficulty_difference: sub.difficulty,
          })
          .onConflictDoNothing();

        // Add reverse substitution with slightly lower similarity
        await tx
          .insert(exerciseSubstitutions)
          .values({
            primary_exercise_id: substituteExercise.id,
            substitute_exercise_id: primaryExercise.id,
            similarity_score: sub.similarity - 0.05,
            muscle_overlap_percentage: sub.overlap,
            difficulty_difference: -sub.difficulty,
          })
          .onConflictDoNothing();
      }
    }
  });

  console.log("Exercise database seeding completed successfully!");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
