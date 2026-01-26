import { err, ok, type Result } from "neverthrow";
import { logger } from "~/logger.server";
import type { ErrRepository } from "~/repository";
import type {
  ImportConfig,
  ImportResult,
  StrongExercise,
  StrongSet,
  StrongSetType,
  StrongWorkoutData,
} from "../domain/strong-import";
import {
  StrongExercise as StrongExerciseFactory,
  StrongSet as StrongSetFactory,
  StrongWorkoutData as StrongWorkoutDataFactory,
} from "../domain/strong-import";
import type {
  Exercise,
  ExerciseType,
  MovementPattern,
  WorkoutExerciseGroup,
  WorkoutSession,
  WorkoutSet,
} from "../domain/workout";
import {
  Workout as WorkoutFactory,
  WorkoutSet as WorkoutSetFactory,
} from "../domain/workout";
import {
  ExerciseRepository as DefaultExerciseRepository,
  type IExerciseRepository,
} from "../infra/repository.server";
import {
  WorkoutRepository as DefaultWorkoutRepository,
  type IWorkoutRepository,
} from "../infra/workout.repository.server";

export interface StrongImportDependencies {
  readonly exerciseRepository: IExerciseRepository;
  readonly workoutRepository: IWorkoutRepository;
}

const defaultDependencies: StrongImportDependencies = {
  exerciseRepository: DefaultExerciseRepository,
  workoutRepository: DefaultWorkoutRepository,
};

export type ErrStrongImport =
  | "invalid_strong_format"
  | "invalid_date_format"
  | "invalid_set_format"
  | "exercise_mapping_failed"
  | "workout_save_failed"
  | "exercise_creation_failed"
  | ErrRepository;

export async function importWorkout(
  strongText: string,
  config: ImportConfig = {
    createMissingExercises: true,
    skipUnmappedExercises: false,
  },
  deps: StrongImportDependencies = defaultDependencies,
): Promise<Result<ImportResult, ErrStrongImport>> {
  const parseResult = parseWorkout(strongText);
  if (parseResult.isErr()) {
    return err(parseResult.error);
  }
  const strongWorkout = parseResult.value;

  const mappingResult = await processExerciseMappings(
    strongWorkout,
    config,
    deps,
  );
  if (mappingResult.isErr()) {
    return err(mappingResult.error);
  }
  const { exerciseMap, createdExercises, unmappedExercises, warnings } =
    mappingResult.value;

  const workoutSessionResult = await createWorkoutSession(
    strongWorkout,
    exerciseMap,
    config,
    deps,
  );
  if (workoutSessionResult.isErr()) {
    return err(workoutSessionResult.error);
  }
  const workoutSession = workoutSessionResult.value;

  const saveResult = await deps.workoutRepository.saveSession(workoutSession);
  if (saveResult.isErr()) {
    return err("workout_save_failed");
  }

  return ok({
    workoutId: workoutSession.workout.id,
    exercisesCreated: createdExercises,
    unmappedExercises,
    warnings,
  });
}

async function processExerciseMappings(
  strongWorkout: StrongWorkoutData,
  config: ImportConfig,
  deps: StrongImportDependencies,
): Promise<
  Result<
    {
      exerciseMap: Map<string, Exercise>;
      createdExercises: string[];
      unmappedExercises: string[];
      warnings: string[];
    },
    ErrStrongImport
  >
> {
  const exerciseMap = new Map<string, Exercise>();
  const createdExercises: string[] = [];
  const unmappedExercises: string[] = [];
  const warnings: string[] = [];

  for (const strongExercise of strongWorkout.exercises) {
    // Try to find existing exercise by name similarity
    const existingExerciseResult = await findExerciseByName(
      strongExercise.name,
      deps,
    );

    if (existingExerciseResult.isOk() && existingExerciseResult.value) {
      exerciseMap.set(strongExercise.name, existingExerciseResult.value);
      continue;
    }

    if (config.createMissingExercises) {
      const newExerciseResult = await createExerciseFromStrong(
        strongExercise.name,
        deps,
      );
      if (newExerciseResult.isErr()) {
        if (config.skipUnmappedExercises) {
          unmappedExercises.push(strongExercise.name);
          warnings.push(
            `Could not create exercise for "${strongExercise.name}"`,
          );
          continue;
        }
        return err("exercise_creation_failed");
      }

      const newExercise = newExerciseResult.value;
      exerciseMap.set(strongExercise.name, newExercise);
      createdExercises.push(newExercise.id);
    } else {
      if (config.skipUnmappedExercises) {
        unmappedExercises.push(strongExercise.name);
        warnings.push(`Skipped unmapped exercise "${strongExercise.name}"`);
      } else {
        return err("exercise_mapping_failed");
      }
    }
  }

  return ok({
    exerciseMap,
    createdExercises,
    unmappedExercises,
    warnings,
  });
}

async function createWorkoutSession(
  strongWorkout: StrongWorkoutData,
  exerciseMap: Map<string, Exercise>,
  config: ImportConfig,
  deps: StrongImportDependencies,
): Promise<Result<WorkoutSession, ErrStrongImport>> {
  // Create the workout
  const start = config.overrideImportTime ?? strongWorkout.date;
  const stop = new Date(start.getTime() + 45 * 60 * 1000);

  const workout = {
    ...WorkoutFactory.create({
      name: strongWorkout.name,
      start,
      importedFromStrong: true,
    }),
    stop,
  };

  // Save the workout to get an ID
  const savedWorkoutResult = await deps.workoutRepository.save(workout);
  if (savedWorkoutResult.isErr()) {
    return err(savedWorkoutResult.error);
  }
  const savedWorkout = savedWorkoutResult.value;

  // Create exercise groups
  const exerciseGroups: WorkoutExerciseGroup[] = [];
  let orderIndex = 0;

  for (const strongExercise of strongWorkout.exercises) {
    const exercise = exerciseMap.get(strongExercise.name);
    if (!exercise) {
      // Skip exercises we couldn't map
      continue;
    }

    // Convert Strong sets to workout sets with sequential numbering
    const workoutSets: WorkoutSet[] = [];
    let setCounter = 1; // Sequential counter for all sets (warm-up + working)

    for (const strongSet of strongExercise.sets) {
      const setResult = WorkoutSetFactory.create({
        workout: savedWorkout,
        exercise,
        set: setCounter, // Use sequential counter instead of original set number
        reps: strongSet.reps,
        weight: strongSet.weight === 0 ? undefined : strongSet.weight, // Use undefined for bodyweight exercises
        note: strongSet.note,
        isCompleted: true, // Strong exports are completed workouts
        isFailure: strongSet.setType === "failure",
        isWarmup: strongSet.setType === "warmup",
      });

      if (setResult.isErr()) {
        logger.error({ err: setResult.error }, "Failed to create workout set");
        return err("workout_save_failed");
      }

      const createdSet = setResult.value;

      workoutSets.push(createdSet);
      setCounter++; // Increment for next set
    }

    exerciseGroups.push({
      exercise,
      sets: workoutSets,
      orderIndex,
      notes: undefined,
    });

    orderIndex++;
  }

  return ok({
    workout: savedWorkout,
    exerciseGroups,
  });
}

async function _getExerciseById(
  deps: StrongImportDependencies,
  id: string,
): Promise<Result<Exercise, ErrRepository>> {
  return deps.exerciseRepository.listAll().map((records) => {
    const record = records.find((r) => r.id === id);
    if (!record) {
      throw new Error("Exercise not found");
    }
    return record;
  });
}

async function createExerciseFromStrong(
  strongName: string,
  deps: StrongImportDependencies,
): Promise<Result<Exercise, ErrRepository>> {
  const { type, movementPattern } = inferExerciseTypeAndPattern(strongName);

  return deps.exerciseRepository.create({
    name: strongName,
    type,
    movementPattern,
    description: `Created from Strong import: ${strongName}`,
  });
}

function inferExerciseTypeAndPattern(name: string): {
  type: ExerciseType;
  movementPattern: MovementPattern;
} {
  const lowerName = name.toLowerCase();

  let type: ExerciseType = "machine";
  if (lowerName.includes("dumbbell")) type = "dumbbells";
  else if (lowerName.includes("barbell")) type = "barbell";
  else if (lowerName.includes("cable")) type = "cable";
  else if (
    lowerName.includes("bodyweight") ||
    lowerName.includes("push-up") ||
    lowerName.includes("pull-up")
  )
    type = "bodyweight";

  let movementPattern: MovementPattern = "isolation";
  if (lowerName.includes("press") || lowerName.includes("push"))
    movementPattern = "push";
  else if (
    lowerName.includes("pull") ||
    lowerName.includes("row") ||
    lowerName.includes("pulldown")
  )
    movementPattern = "pull";
  else if (lowerName.includes("squat") || lowerName.includes("leg press"))
    movementPattern = "squat";
  else if (lowerName.includes("deadlift") || lowerName.includes("hip hinge"))
    movementPattern = "hinge";
  else if (
    lowerName.includes("plank") ||
    lowerName.includes("crunch") ||
    lowerName.includes("abs")
  )
    movementPattern = "core";

  return { type, movementPattern };
}

export function validateStrongText(text: string): Result<boolean, string> {
  if (!text || text.trim().length === 0) {
    return err("Text is empty");
  }

  if (!isValidStrongExport(text)) {
    return err("Text does not appear to be a valid Strong export");
  }

  return ok(true);
}

function parseWorkout(
  text: string,
): Result<StrongWorkoutData, ErrStrongImport> {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) {
    return err("invalid_strong_format");
  }

  const workoutName = lines[0];

  const dateTimeResult = parseDateTime(lines[1]);
  if (dateTimeResult.isErr()) {
    return err(dateTimeResult.error);
  }
  const workoutDate = dateTimeResult.value;

  const exerciseLines = lines.slice(2);
  const exercisesResult = parseExercises(exerciseLines);
  if (exercisesResult.isErr()) {
    return err(exercisesResult.error);
  }

  return StrongWorkoutDataFactory.create(
    workoutName,
    workoutDate,
    exercisesResult.value,
    text,
  ).mapErr(() => "invalid_strong_format" as const);
}

function parseDateTime(dateTimeStr: string): Result<Date, ErrStrongImport> {
  const cleanStr = dateTimeStr.replace(/\s+at\s+/, " ");

  const formats = [
    /^(\w+)\s+(\d+)\s+(\w+)\s+(\d{4})\s+(\d{1,2}):(\d{2})$/,
    /^(\d+)\s+(\w+)\s+(\d{4})\s+(\d{1,2}):(\d{2})$/,
  ];

  for (const format of formats) {
    const match = cleanStr.match(format);
    if (match) {
      try {
        let day: string;
        let month: string;
        let year: string;
        let hour: string;
        let minute: string;

        if (match.length === 7) {
          [, , day, month, year, hour, minute] = match;
        } else {
          [, day, month, year, hour, minute] = match;
        }

        const monthMap: Record<string, number> = {
          January: 0,
          February: 1,
          March: 2,
          April: 3,
          May: 4,
          June: 5,
          July: 6,
          August: 7,
          September: 8,
          October: 9,
          November: 10,
          December: 11,
        };

        const monthNum = monthMap[month];
        if (monthNum === undefined) {
          continue;
        }

        const date = new Date(
          Number.parseInt(year, 10),
          monthNum,
          Number.parseInt(day, 10),
          Number.parseInt(hour, 10),
          Number.parseInt(minute, 10),
        );

        if (!Number.isNaN(date.getTime())) {
          return ok(date);
        }
      } catch (_e) {
        // Continue to next format
      }
    }
  }

  return err("invalid_date_format");
}

function parseExercises(
  lines: string[],
): Result<ReadonlyArray<StrongExercise>, ErrStrongImport> {
  const exercises: StrongExercise[] = [];
  let currentExerciseName = "";
  let currentSets: StrongSet[] = [];

  for (const line of lines) {
    if (line.startsWith("http") || line.length === 0) {
      continue;
    }

    if (isSetLine(line)) {
      const setResult = parseSet(line, currentSets.length + 1);
      if (setResult.isErr()) {
        return err(setResult.error);
      }
      currentSets.push(setResult.value);
    } else {
      if (currentExerciseName && currentSets.length > 0) {
        const exerciseResult = StrongExerciseFactory.create(
          currentExerciseName,
          currentSets,
        );
        if (exerciseResult.isErr()) {
          return err("invalid_strong_format");
        }
        exercises.push(exerciseResult.value);
      }

      currentExerciseName = line;
      currentSets = [];
    }
  }

  if (currentExerciseName && currentSets.length > 0) {
    const exerciseResult = StrongExerciseFactory.create(
      currentExerciseName,
      currentSets,
    );
    if (exerciseResult.isErr()) {
      return err("invalid_strong_format");
    }
    exercises.push(exerciseResult.value);
  }

  if (exercises.length === 0) {
    return err("invalid_strong_format");
  }

  return ok(exercises);
}

function isSetLine(line: string): boolean {
  // Match both formats:
  // 1. "Set 1: 20 kg × 10" or "W1: 20 kg × 10" (weight + reps format)
  // 2. "Set 1: 10 reps" or "W1: 10 reps" (reps-only format for bodyweight)
  const weightFormat =
    /^(Set\s+\d+|W\d+):\s*\d+(?:[.,]\d+)?\s*kg\s*×\s*\d+/.test(line);
  const repsOnlyFormat = /^(Set\s+\d+|W\d+):\s*\d+\s*reps/.test(line);

  return weightFormat || repsOnlyFormat;
}

function parseSet(
  line: string,
  defaultSetNumber: number,
): Result<StrongSet, ErrStrongImport> {
  // Try weight format first: "Set 1: 20 kg × 10" or "W1: 20 kg × 10"
  const weightRegex =
    /^(Set\s+(\d+)|W(\d+)):\s*(\d+(?:[.,]\d+)?)\s*kg\s*×\s*(\d+)(?:\s*\[([^\]]+)\])?/;
  const weightMatch = line.match(weightRegex);

  if (weightMatch) {
    const [, , regularSetNum, warmupSetNum, weightStr, repsStr, note] =
      weightMatch;

    let setNumber: number;
    let setType: StrongSetType;

    if (warmupSetNum) {
      setNumber = Number.parseInt(warmupSetNum, 10);
      setType = "warmup";
    } else if (regularSetNum) {
      setNumber = Number.parseInt(regularSetNum, 10);
      setType = "regular";
    } else {
      setNumber = defaultSetNumber;
      setType = "regular";
    }

    if (note && note.trim().toLowerCase() === "failure") {
      setType = "failure";
    }

    const normalizedWeightStr = weightStr.replace(",", ".");
    const weight = Number.parseFloat(normalizedWeightStr);
    const reps = Number.parseInt(repsStr, 10);

    if (Number.isNaN(weight) || Number.isNaN(reps)) {
      return err("invalid_strong_format");
    }

    return StrongSetFactory.create(
      setNumber,
      weight,
      reps,
      setType,
      note?.trim(),
    );
  }

  // Try reps-only format: "Set 1: 10 reps" or "W1: 10 reps" (bodyweight exercises)
  const repsRegex = /^(Set\s+(\d+)|W(\d+)):\s*(\d+)\s*reps(?:\s*\[([^\]]+)\])?/;
  const repsMatch = line.match(repsRegex);

  if (repsMatch) {
    const [, , regularSetNum, warmupSetNum, repsStr, note] = repsMatch;

    let setNumber: number;
    let setType: StrongSetType;

    if (warmupSetNum) {
      setNumber = Number.parseInt(warmupSetNum, 10);
      setType = "warmup";
    } else if (regularSetNum) {
      setNumber = Number.parseInt(regularSetNum, 10);
      setType = "regular";
    } else {
      setNumber = defaultSetNumber;
      setType = "regular";
    }

    if (note && note.trim().toLowerCase() === "failure") {
      setType = "failure";
    }

    const reps = Number.parseInt(repsStr, 10);

    if (Number.isNaN(reps)) {
      return err("invalid_strong_format");
    }

    // For bodyweight exercises, weight is 0 (we'll handle this in the domain model)
    return StrongSetFactory.create(
      setNumber,
      0, // Keep 0 for Strong domain model, but we'll pass undefined to WorkoutSet
      reps,
      setType,
      note?.trim(),
    );
  }

  return err("invalid_set_format");
}

async function findExerciseByName(
  strongName: string,
  deps: StrongImportDependencies,
): Promise<Result<Exercise | null, ErrRepository>> {
  return deps.exerciseRepository.listAll().map((records) => {
    const normalizedStrongName = normalizeExerciseName(strongName);

    // Look for exact match first
    for (const record of records) {
      const normalizedExerciseName = normalizeExerciseName(record.name);
      if (normalizedStrongName === normalizedExerciseName) {
        return {
          id: record.id,
          name: record.name,
          type: record.type,
          movementPattern: record.movementPattern,
          description: record.description ?? undefined,
        };
      }
    }

    // Look for partial matches with high similarity
    for (const record of records) {
      const similarity = calculateNameSimilarity(strongName, record.name);
      if (similarity >= 0.8) {
        return {
          id: record.id,
          name: record.name,
          type: record.type,
          movementPattern: record.movementPattern,
          description: record.description ?? undefined,
        };
      }
    }

    return null;
  });
}

function normalizeExerciseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, "") // Remove parentheses and content
    .replace(/[^\w\s]/g, "") // Remove special characters
    .replace(/\s+/g, " ") // Normalize spaces
    .trim();
}

function calculateNameSimilarity(name1: string, name2: string): number {
  const norm1 = normalizeExerciseName(name1);
  const norm2 = normalizeExerciseName(name2);

  if (norm1 === norm2) return 1.0;
  if (norm1.includes(norm2) || norm2.includes(norm1)) return 0.9;

  const words1 = norm1.split(" ");
  const words2 = norm2.split(" ");

  const intersection = words1.filter((word) => words2.includes(word));
  const union = [...new Set([...words1, ...words2])];

  return intersection.length / union.length;
}

function isValidStrongExport(text: string): boolean {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 4) {
    return false;
  }

  const dateRegex = /\w+\s+\d+\s+\w+\s+\d{4}\s+at\s+\d{1,2}:\d{2}/;
  if (!dateRegex.test(lines[1])) {
    return false;
  }

  return lines.some((line) => isSetLine(line));
}
