import { redirect } from "react-router";
import type { GeneratedWorkout } from "~/modules/fitness/domain/ai-generation";
import type { WorkoutSession } from "~/modules/fitness/domain/workout";
import { Workout } from "~/modules/fitness/domain/workout";
import { AIWorkoutGenerationRepository } from "~/modules/fitness/infra/ai-workout-generation.repository.server";
import { ExerciseRepository } from "~/modules/fitness/infra/repository.server";
import { WorkoutRepository } from "~/modules/fitness/infra/workout.repository.server";
import { handleResultError } from "~/utils/errors";

export async function createWorkoutFromGeneration(
  generatedWorkout: GeneratedWorkout,
  conversationId: string,
): Promise<Response> {
  const workout = Workout.create({ name: generatedWorkout.name });
  const saveResult = await WorkoutRepository.save(workout);

  if (saveResult.isErr()) {
    handleResultError(saveResult, "Failed to create workout");
  }

  const savedWorkout = saveResult.value;

  // Fetch exercise details for the generated workout
  const exercisesResult = await ExerciseRepository.listAll();
  if (exercisesResult.isErr()) {
    handleResultError(exercisesResult, "Failed to load exercises");
  }

  const exerciseMap = new Map(exercisesResult.value.map((e) => [e.id, e]));

  const newSession: WorkoutSession = {
    workout: savedWorkout,
    exerciseGroups: generatedWorkout.exercises.map((genExercise, index) => {
      const exercise = exerciseMap.get(genExercise.exerciseId) ?? {
        id: genExercise.exerciseId,
        name: genExercise.exerciseName,
        type: "barbell" as const,
        movementPattern: "push" as const,
      };

      return {
        exercise,
        orderIndex: index,
        notes: genExercise.notes,
        sets: genExercise.sets.map((s) => ({
          workoutId: savedWorkout.id,
          exerciseId: genExercise.exerciseId,
          set: s.setNumber,
          targetReps: s.targetReps,
          reps: undefined,
          weight: s.targetWeight,
          note: undefined,
          isCompleted: false,
          isFailure: false,
          isWarmup: s.isWarmup,
        })),
      };
    }),
  };

  const sessionSaveResult = await WorkoutRepository.saveSession(newSession);
  if (sessionSaveResult.isErr()) {
    handleResultError(sessionSaveResult, "Failed to save workout session");
  }

  // Link the generation conversation to the created workout
  await AIWorkoutGenerationRepository.linkConversationToWorkout(
    conversationId,
    savedWorkout.id,
  );

  return redirect(`/workouts/${savedWorkout.id}`);
}
