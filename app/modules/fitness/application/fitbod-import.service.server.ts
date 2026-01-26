import { err, ok, type Result } from "neverthrow";
import { logger } from "~/logger.server";
import type { ErrRepository } from "~/repository";
import type {
  FitbodExercise,
  FitbodWorkoutData,
  ImportConfig,
  ImportResult,
} from "../domain/fitbod-import";
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

export interface FitbodImportDependencies {
  readonly exerciseRepository: IExerciseRepository;
  readonly workoutRepository: IWorkoutRepository;
}

const defaultDependencies: FitbodImportDependencies = {
  exerciseRepository: DefaultExerciseRepository,
  workoutRepository: DefaultWorkoutRepository,
};

export type ErrFitbodImport =
  | "invalid_fitbod_format"
  | "invalid_csv_format"
  | "no_workouts_found"
  | "exercise_mapping_failed"
  | "workout_save_failed"
  | "exercise_creation_failed"
  | ErrRepository;

interface FitbodRow {
  date: string;
  exercise: string;
  reps: number;
  weight: number;
  duration: number;
  distance: number;
  isWarmup: boolean;
  note?: string;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseFitbodRow(
  line: string,
  headerMap: Map<string, number>,
): FitbodRow | null {
  const values = parseCSVLine(line);

  const getVal = (header: string): string => {
    const idx = headerMap.get(header);
    return idx !== undefined ? (values[idx] ?? "") : "";
  };

  const reps = Number.parseInt(getVal("Reps"), 10) || 0;
  const duration = Number.parseFloat(getVal("Duration(s)")) || 0;
  const distance = Number.parseFloat(getVal("Distance(m)")) || 0;

  if ((duration > 0 || distance > 0) && reps === 0) {
    return null;
  }

  if (reps === 0) {
    return null;
  }

  return {
    date: getVal("Date"),
    exercise: getVal("Exercise"),
    reps,
    weight: Number.parseFloat(getVal("Weight(kg)")) || 0,
    duration,
    distance,
    isWarmup: getVal("isWarmup").toLowerCase() === "true",
    note: getVal("Note") || undefined,
  };
}

function parseCSV(
  content: string,
): Result<FitbodWorkoutData[], ErrFitbodImport> {
  const lines = content
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    return err("invalid_csv_format");
  }

  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine);
  const headerMap = new Map<string, number>();
  for (let i = 0; i < headers.length; i++) {
    headerMap.set(headers[i], i);
  }

  const requiredHeaders = ["Date", "Exercise", "Reps", "Weight(kg)"];
  for (const h of requiredHeaders) {
    if (!headerMap.has(h)) {
      return err("invalid_csv_format");
    }
  }

  const rows: FitbodRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const row = parseFitbodRow(lines[i], headerMap);
    if (row) {
      rows.push(row);
    }
  }

  if (rows.length === 0) {
    return err("no_workouts_found");
  }

  const workoutMap = new Map<string, FitbodRow[]>();
  for (const row of rows) {
    const existing = workoutMap.get(row.date) ?? [];
    existing.push(row);
    workoutMap.set(row.date, existing);
  }

  const workouts: FitbodWorkoutData[] = [];
  for (const [dateStr, workoutRows] of workoutMap) {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) {
      continue;
    }

    const exerciseMap = new Map<string, FitbodRow[]>();
    for (const row of workoutRows) {
      const existing = exerciseMap.get(row.exercise) ?? [];
      existing.push(row);
      exerciseMap.set(row.exercise, existing);
    }

    const fitbodExercises: FitbodExercise[] = [];
    for (const [name, exerciseRows] of exerciseMap) {
      fitbodExercises.push({
        name,
        sets: exerciseRows.map((r) => ({
          weight: r.weight,
          reps: r.reps,
          isWarmup: r.isWarmup,
          note: r.note,
        })),
      });
    }

    workouts.push({
      date,
      exercises: fitbodExercises,
    });
  }

  workouts.sort((a, b) => a.date.getTime() - b.date.getTime());

  return ok(workouts);
}

export function validateFitbodCSV(content: string): Result<boolean, string> {
  if (!content || content.trim().length === 0) {
    return err("CSV content is empty");
  }

  const lines = content.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return err("CSV must have a header row and at least one data row");
  }

  const headers = parseCSVLine(lines[0]);
  const requiredHeaders = ["Date", "Exercise", "Reps", "Weight(kg)"];

  for (const h of requiredHeaders) {
    if (!headers.includes(h)) {
      return err(`Missing required header: ${h}`);
    }
  }

  return ok(true);
}

export async function importFitbodCSV(
  csvContent: string,
  config: ImportConfig = {
    createMissingExercises: true,
    skipUnmappedExercises: false,
  },
  deps: FitbodImportDependencies = defaultDependencies,
): Promise<Result<ImportResult, ErrFitbodImport>> {
  const parseResult = parseCSV(csvContent);
  if (parseResult.isErr()) {
    return err(parseResult.error);
  }

  const fitbodWorkouts = parseResult.value;
  if (fitbodWorkouts.length === 0) {
    return err("no_workouts_found");
  }

  const allResults: ImportResult[] = [];

  for (const fitbodWorkout of fitbodWorkouts) {
    const mappingResult = await processExerciseMappings(
      fitbodWorkout,
      config,
      deps,
    );
    if (mappingResult.isErr()) {
      return err(mappingResult.error);
    }
    const { exerciseMap, createdExercises, unmappedExercises, warnings } =
      mappingResult.value;

    const workoutSessionResult = await createWorkoutSession(
      fitbodWorkout,
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

    allResults.push({
      workoutId: workoutSession.workout.id,
      exercisesCreated: createdExercises,
      unmappedExercises,
      warnings,
    });
  }

  const lastResult = allResults[allResults.length - 1];
  return ok({
    workoutId: lastResult.workoutId,
    exercisesCreated: [
      ...new Set(allResults.flatMap((r) => r.exercisesCreated)),
    ],
    unmappedExercises: [
      ...new Set(allResults.flatMap((r) => r.unmappedExercises)),
    ],
    warnings: [
      ...allResults.flatMap((r) => r.warnings),
      `Imported ${allResults.length} workout(s) from Fitbod`,
    ],
  });
}

async function processExerciseMappings(
  fitbodWorkout: FitbodWorkoutData,
  config: ImportConfig,
  deps: FitbodImportDependencies,
): Promise<
  Result<
    {
      exerciseMap: Map<string, Exercise>;
      createdExercises: string[];
      unmappedExercises: string[];
      warnings: string[];
    },
    ErrFitbodImport
  >
> {
  const exerciseMap = new Map<string, Exercise>();
  const createdExercises: string[] = [];
  const unmappedExercises: string[] = [];
  const warnings: string[] = [];

  for (const fitbodExercise of fitbodWorkout.exercises) {
    const existingExerciseResult = await findExerciseByName(
      fitbodExercise.name,
      deps,
    );

    if (existingExerciseResult.isOk() && existingExerciseResult.value) {
      exerciseMap.set(fitbodExercise.name, existingExerciseResult.value);
      continue;
    }

    if (config.createMissingExercises) {
      const newExerciseResult = await createExerciseFromFitbod(
        fitbodExercise.name,
        deps,
      );
      if (newExerciseResult.isErr()) {
        if (config.skipUnmappedExercises) {
          unmappedExercises.push(fitbodExercise.name);
          warnings.push(
            `Could not create exercise for "${fitbodExercise.name}"`,
          );
          continue;
        }
        return err("exercise_creation_failed");
      }

      const newExercise = newExerciseResult.value;
      exerciseMap.set(fitbodExercise.name, newExercise);
      createdExercises.push(newExercise.id);
    } else {
      if (config.skipUnmappedExercises) {
        unmappedExercises.push(fitbodExercise.name);
        warnings.push(`Skipped unmapped exercise "${fitbodExercise.name}"`);
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
  fitbodWorkout: FitbodWorkoutData,
  exerciseMap: Map<string, Exercise>,
  config: ImportConfig,
  deps: FitbodImportDependencies,
): Promise<Result<WorkoutSession, ErrFitbodImport>> {
  const dateStr = fitbodWorkout.date.toISOString().split("T")[0];
  const workoutName = `Fitbod Import ${dateStr}`;

  const start = config.overrideImportTime ?? fitbodWorkout.date;
  const stop = new Date(start.getTime() + 45 * 60 * 1000);

  const workout = {
    ...WorkoutFactory.create({
      name: workoutName,
      start,
      importedFromFitbod: true,
    }),
    stop,
  };

  const savedWorkoutResult = await deps.workoutRepository.save(workout);
  if (savedWorkoutResult.isErr()) {
    return err(savedWorkoutResult.error);
  }
  const savedWorkout = savedWorkoutResult.value;

  const exerciseGroups: WorkoutExerciseGroup[] = [];
  let orderIndex = 0;

  for (const fitbodExercise of fitbodWorkout.exercises) {
    const exercise = exerciseMap.get(fitbodExercise.name);
    if (!exercise) {
      continue;
    }

    const workoutSetsForExercise: WorkoutSet[] = [];
    let setCounter = 1;

    for (const fitbodSet of fitbodExercise.sets) {
      const setResult = WorkoutSetFactory.create({
        workout: savedWorkout,
        exercise,
        set: setCounter,
        reps: fitbodSet.reps,
        weight: fitbodSet.weight === 0 ? undefined : fitbodSet.weight,
        note: fitbodSet.note,
        isCompleted: true,
        isFailure: false,
        isWarmup: fitbodSet.isWarmup,
      });

      if (setResult.isErr()) {
        logger.error({ err: setResult.error }, "Failed to create workout set");
        return err("workout_save_failed");
      }

      workoutSetsForExercise.push(setResult.value);
      setCounter++;
    }

    exerciseGroups.push({
      exercise,
      sets: workoutSetsForExercise,
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

async function createExerciseFromFitbod(
  fitbodName: string,
  deps: FitbodImportDependencies,
): Promise<Result<Exercise, ErrRepository>> {
  const { type, movementPattern } = inferExerciseTypeAndPattern(fitbodName);

  return deps.exerciseRepository.create({
    name: fitbodName,
    type,
    movementPattern,
    description: `Created from Fitbod import: ${fitbodName}`,
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
    lowerName.includes("pull-up") ||
    lowerName.includes("pushup") ||
    lowerName.includes("pullup")
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

async function findExerciseByName(
  fitbodName: string,
  deps: FitbodImportDependencies,
): Promise<Result<Exercise | null, ErrRepository>> {
  return deps.exerciseRepository.listAll().map((records) => {
    const normalizedFitbodName = normalizeExerciseName(fitbodName);

    for (const record of records) {
      const normalizedExerciseName = normalizeExerciseName(record.name);
      if (normalizedFitbodName === normalizedExerciseName) {
        return {
          id: record.id,
          name: record.name,
          type: record.type,
          movementPattern: record.movement_pattern,
          description: record.description ?? undefined,
        };
      }
    }

    for (const record of records) {
      const similarity = calculateNameSimilarity(fitbodName, record.name);
      if (similarity >= 0.8) {
        return {
          id: record.id,
          name: record.name,
          type: record.type,
          movementPattern: record.movement_pattern,
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
    .replace(/\([^)]*\)/g, "")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
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
