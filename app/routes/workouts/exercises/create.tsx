import { z } from "zod";
import { zfd } from "zod-form-data";
import ExerciseForm from "~/components/ExerciseForm";
import {
  createExercise,
  type MuscleGroupSplitInput,
} from "~/modules/fitness/application/exercise-form.service.server";
import { formOptionalText, formText } from "~/utils/form-data";
import type { Route } from "./+types";

export const action = async ({ request }: Route.ActionArgs) => {
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

  return createExercise({
    name: parsed.name,
    type: parsed.type,
    movementPattern: parsed.movementPattern,
    description: parsed.description ?? undefined,
    mmcInstructions: parsed.mmcInstructions ?? undefined,
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
