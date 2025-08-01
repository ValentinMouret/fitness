import { Heading } from "@radix-ui/themes";
import { redirect } from "react-router";
import ExerciseForm from "~/components/ExerciseForm";
import { ExerciseMuscleGroupsRepository } from "~/modules/fitness/infra/repository.server";
import { ExerciseService } from "~/modules/fitness/application/service.server";
import {
  ExerciseMuscleGroupsAggregate,
  parseExerciseType,
  parseMuscleGroup,
  parseMovementPattern,
  type Exercise,
  type MuscleGroupSplit,
} from "~/modules/fitness/domain/workout";
import { coerceEmpty, humanFormatting } from "~/strings";
import { coerceInt } from "~/utils";
import type { Route } from "./+types/edit";

export const loader = async ({ params }: Route.LoaderArgs) => {
  const exerciseId = params["exercise-id"];

  if (!exerciseId) {
    throw new Error("Exercise ID is required");
  }

  const exerciseResult =
    await ExerciseMuscleGroupsRepository.findById(exerciseId);

  if (exerciseResult.isErr()) {
    throw new Error("Error fetching exercise");
  }

  if (exerciseResult.value === null) {
    throw new Error("Exercise not found");
  }

  return {
    exercise: exerciseResult.value,
  };
};

export const action = async ({ request, params }: Route.ActionArgs) => {
  const exerciseId = params["exercise-id"];

  if (!exerciseId) {
    throw new Error("Exercise ID is required");
  }

  const oldExerciseResult =
    await ExerciseMuscleGroupsRepository.findById(exerciseId);

  if (oldExerciseResult.isErr()) {
    throw new Error("Error fetching original exercise");
  }

  if (oldExerciseResult.value === null) {
    throw new Error("Original exercise not found");
  }

  const form = await request.formData();
  const exerciseNameForm = form.get("name")?.toString();
  const exerciseTypeString = form.get("type")?.toString();
  const movementPatternString = form.get("movementPattern")?.toString();
  const exerciseDescription = form.get("description")?.toString();

  if (exerciseNameForm === undefined) {
    throw new Error("Invalid exercise: no name");
  }
  if (exerciseTypeString === undefined) {
    throw new Error("Invalid exercise: no type");
  }
  const exerciseType = parseExerciseType(exerciseTypeString);
  if (exerciseType.isErr()) {
    throw new Error("Invalid exercise: invalid exercise type");
  }

  if (movementPatternString === undefined) {
    throw new Error("Invalid exercise: no movement pattern");
  }
  const movementPattern = parseMovementPattern(movementPatternString);
  if (movementPattern.isErr()) {
    throw new Error("Invalid exercise: invalid movement pattern");
  }

  const muscleGroupSplits: MuscleGroupSplit[] = [];
  let i = 0;
  while (true) {
    const muscleGroupString = form.get(`${i}-muscle-group`)?.toString();
    const splitString = form.get(`${i}-split`)?.toString();

    if (muscleGroupString === undefined) break;
    const muscleGroupName = parseMuscleGroup(muscleGroupString);
    const split = coerceInt(splitString ?? "");

    if (muscleGroupName.isErr()) {
      console.error("Error parsing muscle group", { muscleGroupString });
      throw new Error("Error parsing muscle group");
    }
    if (split.isErr()) {
      console.error("Error parsing split", { split });
      throw new Error("Error parsing split");
    }

    muscleGroupSplits.push({
      muscleGroup: muscleGroupName.value,
      split: split.value,
    });

    i++;
  }

  const exercise: Exercise = {
    id: exerciseId,
    name: humanFormatting(exerciseNameForm),
    type: exerciseType.value,
    movementPattern: movementPattern.value,
    description: coerceEmpty(exerciseDescription ?? ""),
  };
  const newExerciseMuscleGroup = ExerciseMuscleGroupsAggregate.create(
    exercise,
    muscleGroupSplits,
    true,
  );

  if (newExerciseMuscleGroup.isErr()) {
    throw new Error("Invalid muscle group");
  }

  const result = await ExerciseService.update(
    oldExerciseResult.value,
    newExerciseMuscleGroup.value,
  );
  if (result.isErr()) {
    throw new Error("Error updating exercise");
  }

  throw redirect("/workouts/exercises");
};

export default function EditExercisePage({ loaderData }: Route.ComponentProps) {
  const { exercise } = loaderData;

  return (
    <>
      <Heading size="7">Edit exercise</Heading>
      <ExerciseForm
        initialExercise={exercise.exercise}
        initialSplits={exercise.muscleGroupSplits}
        mode="edit"
      />
    </>
  );
}
