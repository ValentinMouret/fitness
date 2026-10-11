import type { Workout, WorkoutSession } from "./workout";

/**
 * Plans a new session from a past one: same exercises and sets, with what was
 * performed becoming the target and nothing marked as done.
 */
export function planRepeatedSession(
  source: WorkoutSession,
  workout: Workout,
): WorkoutSession {
  return {
    workout,
    exerciseGroups: source.exerciseGroups.map((group) => ({
      exercise: group.exercise,
      orderIndex: group.orderIndex,
      notes: group.notes,
      sets: group.sets.map((set) => ({
        workoutId: workout.id,
        exerciseId: group.exercise.id,
        set: set.set,
        targetReps: set.reps ?? set.targetReps,
        weight: set.weight,
        isCompleted: false,
        isFailure: false,
        isWarmup: set.isWarmup,
      })),
    })),
  };
}
