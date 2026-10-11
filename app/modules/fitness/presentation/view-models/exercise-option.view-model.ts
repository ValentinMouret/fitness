import type { Exercise, ExerciseType } from "~/modules/fitness/domain/workout";

export interface ExerciseOptionViewModel {
  readonly id: string;
  readonly name: string;
  readonly type: ExerciseType;
  /** ISO timestamp of the last finished session with this exercise. */
  readonly lastPerformedAt?: string;
}

/** Catalogue exercises that can still be added to the workout. */
export function createExerciseOptionViewModels(
  catalogue: ReadonlyArray<Exercise>,
  lastPerformed: ReadonlyMap<string, Date>,
  inWorkout: ReadonlySet<string>,
): ReadonlyArray<ExerciseOptionViewModel> {
  return catalogue
    .filter((exercise) => !inWorkout.has(exercise.id))
    .map((exercise) => ({
      id: exercise.id,
      name: exercise.name,
      type: exercise.type,
      lastPerformedAt: lastPerformed.get(exercise.id)?.toISOString(),
    }));
}

/** Formats in the device's time zone, like the exercise history. */
export function formatLastPerformed(lastPerformedAt: string | undefined) {
  if (!lastPerformedAt) return "Not done before";
  const day = new Date(lastPerformedAt).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  return `Last: ${day}`;
}
