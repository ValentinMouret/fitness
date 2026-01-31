import ExerciseForm from "~/components/ExerciseForm";
import type { Route } from "./+types";
import {
  createExercise,
  type MuscleGroupSplitInput,
} from "~/modules/fitness/application/exercise-form.service.server";

export const action = async ({ request }: Route.ActionArgs) => {
  const form = await request.formData();
  const exerciseName = form.get("name")?.toString();
  const exerciseTypeString = form.get("type")?.toString();
  const movementPatternString = form.get("movementPattern")?.toString();
  const exerciseDescription = form.get("description")?.toString();
  const mmcInstructions = form.get("mmcInstructions")?.toString();

  const muscleGroupSplits: MuscleGroupSplitInput[] = [];
  let i = 0;
  while (true) {
    const muscleGroupString = form.get(`${i}-muscle-group`)?.toString();
    const splitString = form.get(`${i}-split`)?.toString();

    if (muscleGroupString === undefined) break;
    muscleGroupSplits.push({
      muscleGroup: muscleGroupString,
      split: splitString ?? "",
    });

    i++;
  }

  return createExercise({
    name: exerciseName,
    type: exerciseTypeString,
    movementPattern: movementPatternString,
    description: exerciseDescription,
    mmcInstructions,
    splits: muscleGroupSplits,
  });
};

export const handle = {
  header: () => ({
    title: "New Exercise",
    backTo: "/workouts/exercises",
  }),
};

export default function CreateExercisePage() {
  return <ExerciseForm mode="create" />;
}
