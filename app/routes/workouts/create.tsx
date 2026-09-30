import { authenticatedUserContext } from "~/modules/auth/infra/user-context.server";
import { createWorkoutFromNow } from "~/modules/fitness/infra/create-workout.service.server";
import type { Route } from "./+types/create";
export async function action({ context }: Route.ActionArgs) {
  return createWorkoutFromNow(context.get(authenticatedUserContext).id);
}

export default function WorkoutCreate() {
  return null;
}
