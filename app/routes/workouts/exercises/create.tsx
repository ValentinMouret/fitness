import { Heading } from "@radix-ui/themes";
import { redirect } from "react-router";
import ExerciseForm from "~/components/ExerciseForm";
import {
  ExerciseMuscleGroupsAggregate,
  parseExerciseType,
  parseMuscleGroup,
  parseMovementPattern,
  type Exercise,
  type MuscleGroupSplit,
} from "~/modules/fitness/domain/workout";
import { coerceEmpty, humanFormatting } from "~/strings";
import type { Route } from "./+types";
import { coerceInt } from "~/utils";
import { ExerciseMuscleGroupsRepository } from "~/modules/fitness/infra/repository.server";

export const action = async ({ request }: Route.ActionArgs) => {
  const form = await request.formData();
  const exerciseName = form.get("name")?.toString();
  const exerciseTypeString = form.get("type")?.toString();
  const movementPatternString = form.get("movementPattern")?.toString();
  const exerciseDescription = form.get("description")?.toString();

  if (exerciseName === undefined) {
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
    id: crypto.randomUUID(),
    name: humanFormatting(exerciseName),
    type: exerciseType.value,
    movementPattern: movementPattern.value,
    description: coerceEmpty(exerciseDescription ?? ""),
  };
  const muscleGroup = ExerciseMuscleGroupsAggregate.create(
    exercise,
    muscleGroupSplits,
    true,
  );

  if (muscleGroup.isErr()) {
    throw new Error("Invalid muscle group");
  }

  const result = await ExerciseMuscleGroupsRepository.save(muscleGroup.value);
  if (result.isErr()) {
    throw new Error("Error writing to database");
  }

  throw redirect("/workouts/exercises");
};

export default function CreateExercisePage() {
  return (
    <>
      <Heading size="7">New exercise</Heading>
      <ExerciseForm mode="create" />
    </>
  );
}
