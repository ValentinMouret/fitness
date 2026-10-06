import { redirect } from "react-router";
import type { UserId } from "~/modules/auth/domain/user";
import { getOrdinalSuffix } from "~/time";
import { handleResultError } from "~/utils/errors";
import { createWorkoutCommands } from "./workout.repository.server";

export async function createWorkoutFromNow(userId: UserId): Promise<Response> {
  const now = new Date();
  const weekday = now.toLocaleDateString("en-US", { weekday: "long" });
  const date = now.getDate();
  const ordinalSuffix = getOrdinalSuffix(date);

  const workoutName = `${weekday}, ${date}${ordinalSuffix}`;
  const result = await createWorkoutCommands(userId).createWorkout({
    name: workoutName,
    exercises: [],
  });

  if (result.isErr()) {
    handleResultError(result, "Failed to create workout");
  }

  return redirect(`/workouts/${result.value.workout.id}`);
}
