import { z } from "zod";
import { zfd } from "zod-form-data";
import ExerciseForm from "~/components/ExerciseForm";
import {
  getExerciseForEdit,
  type MuscleGroupSplitInput,
  updateExercise,
} from "~/modules/fitness/infra/exercise-form.service.server";
import { formOptionalText, formText } from "~/utils/form-data";
import type { Route } from "./+types/edit";

export const loader = async ({ params }: Route.LoaderArgs) => {
  const exerciseId = params["exercise-id"];

  const exercise = await getExerciseForEdit(exerciseId);
  return { exercise };
};

export const handle = {
  header: (data: Route.ComponentProps["loaderData"]) => ({
    title: `Edit ${data?.exercise?.exercise?.name || "Exercise"}`,
    backTo: "/workouts/exercises",
  }),
};

export const action = async ({ request, params }: Route.ActionArgs) => {
  const exerciseId = params["exercise-id"];

  const form = await request.formData();
  const schema = zfd.formData({
    name: formText(z.string().min(1)),
    type: formText(z.string().min(1)),
    movementPattern: formText(z.string().min(1)),
    description: formOptionalText(),
    mmcInstructions: formOptionalText(),
  });
  const parsed = schema.parse(form);

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

  return updateExercise({
    id: exerciseId ?? "",
    name: parsed.name,
    type: parsed.type,
    movementPattern: parsed.movementPattern,
    description: parsed.description ?? undefined,
    mmcInstructions: parsed.mmcInstructions ?? undefined,
    splits: muscleGroupSplits,
  });
};

export default function EditExercisePage({ loaderData }: Route.ComponentProps) {
  const { exercise } = loaderData;

  return (
    <ExerciseForm
      initialExercise={exercise.exercise}
      initialSplits={exercise.muscleGroupSplits}
      mode="edit"
    />
  );
}
