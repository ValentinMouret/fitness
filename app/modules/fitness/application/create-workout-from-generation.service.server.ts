import { redirect } from "react-router";
import { db } from "~/db";
import { workoutExercises, workoutSets, workouts } from "~/db/schema";
import { logger } from "~/logger.server";
import type {
  GeneratedExerciseSet,
  GeneratedWorkout,
} from "~/modules/fitness/domain/ai-generation";
import { AIWorkoutGenerationRepository } from "~/modules/fitness/infra/ai-workout-generation.repository.server";
import { ExerciseRepository } from "~/modules/fitness/infra/repository.server";
import { createServerError, handleResultError } from "~/utils/errors";

/** Convert zero to undefined so the DB column stays NULL (check constraints require > 0). */
function positiveOrNull(value: number | undefined): number | null {
  if (value === undefined || value <= 0) return null;
  return value;
}

/** Ensure set number is at least 1 (DB constraint: set > 0). */
function sanitizeSetNumber(set: GeneratedExerciseSet, index: number): number {
  return set.setNumber > 0 ? set.setNumber : index + 1;
}

export async function createWorkoutFromGeneration(
  generatedWorkout: GeneratedWorkout,
  conversationId: string,
): Promise<Response> {
  const exercisesResult = await ExerciseRepository.listAll();
  if (exercisesResult.isErr()) {
    handleResultError(exercisesResult, "Failed to load exercises");
  }

  const exerciseMap = new Map(exercisesResult.value.map((e) => [e.id, e]));

  // Filter out exercises that don't exist in the catalog
  const validExercises = generatedWorkout.exercises.filter((genExercise) => {
    if (!exerciseMap.has(genExercise.exerciseId)) {
      logger.warn(
        { exerciseId: genExercise.exerciseId, name: genExercise.exerciseName },
        "AI generated exercise not found in catalog, skipping",
      );
      return false;
    }
    return true;
  });

  if (validExercises.length === 0) {
    throw createServerError("No valid exercises in generated workout", 422);
  }

  let workoutId: string;

  try {
    workoutId = await db.transaction(async (tx) => {
      // Create the workout
      const [workoutRecord] = await tx
        .insert(workouts)
        .values({
          name: generatedWorkout.name,
          start: new Date(),
          imported_from_strong: false,
          imported_from_fitbod: false,
        })
        .returning({ id: workouts.id });

      const wId = workoutRecord.id;

      // Insert exercises and sets
      for (let i = 0; i < validExercises.length; i++) {
        const genExercise = validExercises[i];

        await tx.insert(workoutExercises).values({
          workout_id: wId,
          exercise_id: genExercise.exerciseId,
          order_index: i,
          notes: genExercise.notes ?? null,
        });

        for (let j = 0; j < genExercise.sets.length; j++) {
          const s = genExercise.sets[j];
          await tx.insert(workoutSets).values({
            workout: wId,
            exercise: genExercise.exerciseId,
            set: sanitizeSetNumber(s, j),
            targetReps: positiveOrNull(s.targetReps),
            reps: null,
            weight: positiveOrNull(s.targetWeight),
            note: null,
            isCompleted: false,
            isFailure: false,
            isWarmup: s.isWarmup,
          });
        }
      }

      return wId;
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to create workout from generation");
    throw createServerError("Failed to create workout from generation", 500);
  }

  // Link the generation conversation to the created workout (non-critical)
  await AIWorkoutGenerationRepository.linkConversationToWorkout(
    conversationId,
    workoutId,
  );

  return redirect(`/workouts/${workoutId}`);
}
