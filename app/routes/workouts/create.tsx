import { createWorkoutFromNow } from "~/modules/fitness/application/create-workout.service.server";

export async function action() {
  return createWorkoutFromNow();
}

export default function WorkoutCreate() {
  return null;
}
