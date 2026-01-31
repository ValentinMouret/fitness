import { Heading, Flex, IconButton } from "@radix-ui/themes";
import { ArrowLeftIcon } from "@radix-ui/react-icons";
import { Link } from "react-router";
import ExerciseForm from "~/components/ExerciseForm";
import type { Route } from "./+types/edit";
import {
  getExerciseForEdit,
  type MuscleGroupSplitInput,
  updateExercise,
} from "~/modules/fitness/application/exercise-form.service.server";

export const loader = async ({ params }: Route.LoaderArgs) => {
  const exerciseId = params["exercise-id"];

  const exercise = await getExerciseForEdit(exerciseId);
  return { exercise };
};

export const action = async ({ request, params }: Route.ActionArgs) => {
  const exerciseId = params["exercise-id"];

  const form = await request.formData();
  const exerciseNameForm = form.get("name")?.toString();
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

  return updateExercise({
    id: exerciseId ?? "",
    name: exerciseNameForm,
    type: exerciseTypeString,
    movementPattern: movementPatternString,
    description: exerciseDescription,
    mmcInstructions,
    splits: muscleGroupSplits,
  });
};

export default function EditExercisePage({ loaderData }: Route.ComponentProps) {
  const { exercise } = loaderData;

  return (
    <>
      <Flex align="center" gap="4" mb="6">
        <IconButton asChild size="3" variant="ghost">
          <Link to="/workouts/exercises">
            <ArrowLeftIcon />
          </Link>
        </IconButton>
        <Heading size="7">Edit exercise</Heading>
      </Flex>
      <ExerciseForm
        initialExercise={exercise.exercise}
        initialSplits={exercise.muscleGroupSplits}
        mode="edit"
      />
    </>
  );
}
