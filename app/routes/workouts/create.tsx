import { createWorkoutFromNow } from "~/modules/fitness/application/create-workout.service.server";
import { createWorkoutFromTemplate } from "~/modules/fitness/application/workout-template.service.server";
import type { Route } from "./+types/create";

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const templateId = formData.get("templateId")?.toString();

  if (templateId) {
    return createWorkoutFromTemplate(templateId);
  }

  return createWorkoutFromNow();
}

export default function WorkoutCreate() {
  return null;
}
