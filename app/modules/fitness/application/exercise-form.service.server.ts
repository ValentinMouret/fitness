import { redirect } from "react-router";
import { ExerciseService } from "~/modules/fitness/application/service.server";
import {
  type Exercise,
  ExerciseMuscleGroupsAggregate,
  type MuscleGroupSplit,
  parseExerciseType,
  parseMovementPattern,
  parseMuscleGroup,
} from "~/modules/fitness/domain/workout";
import { ExerciseMuscleGroupsRepository } from "~/modules/fitness/infra/repository.server";
import { coerceEmpty, humanFormatting } from "~/strings";
import { coerceInt } from "~/utils";

export type MuscleGroupSplitInput = {
  readonly muscleGroup: string;
  readonly split: string;
};

type BaseExerciseInput = {
  readonly name?: string;
  readonly type?: string;
  readonly movementPattern?: string;
  readonly description?: string;
  readonly mmcInstructions?: string;
  readonly splits: MuscleGroupSplitInput[];
};

function parseSplits(splits: MuscleGroupSplitInput[]): MuscleGroupSplit[] {
  const parsedSplits: MuscleGroupSplit[] = [];

  for (const splitInput of splits) {
    const muscleGroupName = parseMuscleGroup(splitInput.muscleGroup);
    const split = coerceInt(splitInput.split);

    if (muscleGroupName.isErr()) {
      console.error("Error parsing muscle group", { splitInput });
      throw new Error("Error parsing muscle group");
    }
    if (split.isErr()) {
      console.error("Error parsing split", { split });
      throw new Error("Error parsing split");
    }

    parsedSplits.push({
      muscleGroup: muscleGroupName.value,
      split: split.value,
    });
  }

  return parsedSplits;
}

function buildExercise(input: BaseExerciseInput, id: string): Exercise {
  if (input.name === undefined) {
    throw new Error("Invalid exercise: no name");
  }
  if (input.type === undefined) {
    throw new Error("Invalid exercise: no type");
  }
  const exerciseType = parseExerciseType(input.type);
  if (exerciseType.isErr()) {
    throw new Error("Invalid exercise: invalid exercise type");
  }

  if (input.movementPattern === undefined) {
    throw new Error("Invalid exercise: no movement pattern");
  }
  const movementPattern = parseMovementPattern(input.movementPattern);
  if (movementPattern.isErr()) {
    throw new Error("Invalid exercise: invalid movement pattern");
  }

  return {
    id,
    name: humanFormatting(input.name),
    type: exerciseType.value,
    movementPattern: movementPattern.value,
    description: coerceEmpty(input.description ?? ""),
    mmcInstructions: coerceEmpty(input.mmcInstructions ?? ""),
  };
}

export async function createExercise(
  input: BaseExerciseInput,
): Promise<Response> {
  const exerciseId = crypto.randomUUID();
  const exercise = buildExercise(input, exerciseId);
  const muscleGroupSplits = parseSplits(input.splits);

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

  return redirect("/workouts/exercises");
}

export async function getExerciseForEdit(id: string) {
  if (!id) {
    throw new Error("Exercise ID is required");
  }

  const exerciseResult = await ExerciseMuscleGroupsRepository.findById(id);

  if (exerciseResult.isErr()) {
    throw new Error("Error fetching exercise");
  }

  if (exerciseResult.value === null) {
    throw new Error("Exercise not found");
  }

  return exerciseResult.value;
}

export async function updateExercise(
  input: BaseExerciseInput & {
    readonly id: string;
  },
): Promise<Response> {
  if (!input.id) {
    throw new Error("Exercise ID is required");
  }

  const oldExerciseResult = await ExerciseMuscleGroupsRepository.findById(
    input.id,
  );

  if (oldExerciseResult.isErr()) {
    throw new Error("Error fetching original exercise");
  }

  if (oldExerciseResult.value === null) {
    throw new Error("Original exercise not found");
  }

  const exercise = buildExercise(input, input.id);
  const muscleGroupSplits = parseSplits(input.splits);
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

  return redirect("/workouts/exercises");
}
