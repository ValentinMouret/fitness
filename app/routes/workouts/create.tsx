import type { Route } from "./+types";
import { redirect } from "react-router";
import { Workout } from "~/modules/fitness/domain/workout";
import { WorkoutRepository } from "~/modules/fitness/infra/workout.repository.server";

export async function action({ request }: Route.ActionArgs) {
  const workoutName = `Workout ${new Date().toLocaleDateString()}`;

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
