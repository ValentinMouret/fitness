import { redirect } from "react-router";
import { getOrdinalSuffix } from "~/time";
import { handleResultError } from "~/utils/errors";
import { workoutCommands } from "./workout.repository.server";

export async function createWorkoutFromNow(): Promise<Response> {
  const now = new Date();
  const weekday = now.toLocaleDateString("en-US", { weekday: "long" });
  const date = now.getDate();
  const ordinalSuffix = getOrdinalSuffix(date);

  const workoutName = `${weekday}, ${date}${ordinalSuffix}`;
  const result = await workoutCommands.createWorkout({
    name: workoutName,
    exercises: [],
  });

  if (result.isErr()) {
    handleResultError(result, "Failed to create workout");
  }

  return redirect(`/workouts/${result.value.workout.id}`);
}
