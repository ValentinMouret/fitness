import { redirect } from "react-router";
import { Workout } from "~/modules/fitness/domain/workout";
import { WorkoutRepository } from "~/modules/fitness/infra/workout.repository.server";
import { getOrdinalSuffix } from "~/time";
import { handleResultError } from "~/utils/errors";

export async function createWorkoutFromNow(): Promise<Response> {
  const now = new Date();
  const weekday = now.toLocaleDateString("en-US", { weekday: "long" });
  const date = now.getDate();
  const ordinalSuffix = getOrdinalSuffix(date);

  const workoutName = `${weekday}, ${date}${ordinalSuffix}`;
  const workout = Workout.create({ name: workoutName });

  const result = await WorkoutRepository.save(workout);

  if (result.isErr()) {
    handleResultError(result, "Failed to create workout");
  }

  return redirect(`/workouts/${result.value.id}`);
}
