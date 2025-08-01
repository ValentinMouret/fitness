import { redirect } from "react-router";
import { Workout } from "~/modules/fitness/domain/workout";
import { WorkoutRepository } from "~/modules/fitness/infra/workout.repository.server";
import { getOrdinalSuffix } from "~/time";

export async function action() {
  const now = new Date();

  const weekday = now.toLocaleDateString("en-US", { weekday: "long" });

  const date = now.getDate();
  const ordinalSuffix = getOrdinalSuffix(date);

  const workoutName = `${weekday}, ${date}${ordinalSuffix}`;

  const workout = Workout.create({
    name: workoutName,
  });

  const result = await WorkoutRepository.save(workout);

  if (result.isErr()) {
    console.error("Error creating workout:", result.error);
    throw new Error("Failed to create workout");
  }

  return redirect(`/workouts/${result.value.id}`);
}

export default function WorkoutCreate() {
  return null;
}
