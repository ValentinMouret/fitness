import { err, ok, type Result } from "neverthrow";
import type { ErrValidation } from "~/repository";

export const muscleGroups = [
  "abs",
  "armstrings",
  "biceps",
  "calves",
  "delts",
  "forearm",
  "glutes",
  "lats",
  "lower_back",
  "pecs",
  "quads",
  "trapezes",
  "triceps",
] as const;
export type MuscleGroup = (typeof muscleGroups)[number];
export function parseMuscleGroup(
  s: string,
): Result<MuscleGroup, ErrValidation> {
  if (!muscleGroups.includes(s as MuscleGroup)) return err("validation_error");
  return ok(s as MuscleGroup);
}

const allMuscleGroupCategories = ["core", "legs", "arms", "back"] as const;
export type MuscleGroupCategory = (typeof allMuscleGroupCategories)[number];

export const muscleGroupCategories: Record<MuscleGroup, MuscleGroupCategory> = {
  abs: "core",
  armstrings: "legs",
  biceps: "arms",
  calves: "legs",
  delts: "arms",
  forearm: "arms",
  glutes: "legs",
  lats: "back",
  lower_back: "back",
  pecs: "core",
  quads: "legs",
  trapezes: "back",
  triceps: "arms",
};

export const exerciseTypes = [
  "barbell",
  "bodyweight",
  "cable",
  "dumbbells",
  "machine",
] as const;
export type ExerciseType = (typeof exerciseTypes)[number];
export function parseExerciseType(
  s: string,
): Result<ExerciseType, ErrValidation> {
  if (!exerciseTypes.includes(s as ExerciseType))
    return err("validation_error");
  return ok(s as ExerciseType);
}

export interface Exercise {
  readonly id: string;
  readonly name: string;
  readonly type: ExerciseType;
  readonly description?: string;
}

export interface MuscleGroupSplit {
  readonly muscleGroup: MuscleGroup;
  readonly split: number;
}

export interface ExerciseMuscleGroups {
  readonly exercise: Exercise;
  readonly muscleGroupSplits: ReadonlyArray<MuscleGroupSplit>;
}

type ErrInvalidSplits = "Invalid total split";

export const ExerciseMuscleGroupsAggregate = {
  create(
    exercise: Exercise,
    muscleGroupSplits: MuscleGroupSplit[],
    normalize = false,
  ): Result<ExerciseMuscleGroups, ErrInvalidSplits> {
    const total = muscleGroupSplits.reduce((acc, n) => acc + n.split, 0);

    if (!normalize && total !== 100) {
      return err("Invalid total split");
    }

    return ok({
      exercise,
      muscleGroupSplits: normalize
        ? muscleGroupSplits.map(({ muscleGroup, split }) => ({
            muscleGroup,
            split: Math.round((100 * split) / total),
          }))
        : muscleGroupSplits,
    });
  },
};

export interface Workout {
  readonly id: string;
  readonly name: string;
  readonly start: Date;
  readonly stop?: Date;
  readonly notes?: string;
}

interface WorkoutCreateInput {
  readonly name: string;
  readonly start?: Date;
  readonly notes?: string;
}

export const Workout = {
  create(input: WorkoutCreateInput): Omit<Workout, "id"> {
    return {
      name: input.name,
      start: input.start ?? new Date(),
      notes: input.notes,
    };
  },
  stop(this: Workout): Workout {
    return { ...this, stop: new Date() };
  },
};

export interface WorkoutSet {
  readonly workoutId: Workout["id"];
  readonly exerciseId: Exercise["id"];
  readonly set: number;
  readonly targetReps?: number;
  readonly reps?: number;
  readonly weight?: number;
  readonly note?: string;
  readonly isCompleted: boolean;
  readonly isFailure: boolean;
}

interface WorkoutSetCreateInput {
  readonly workout: Workout | string;
  readonly exercise: Exercise;
  readonly set: number;
  readonly targetReps?: number;
  readonly reps?: number;
  readonly weight?: number;
  readonly note?: string;
  readonly isCompleted?: boolean;
  readonly isFailure?: boolean;
}

type ErrInvalidSet = "Invalid set";
type ErrInvalidTargetReps = "Invalid target reps";
type ErrInvalidReps = "Invalid reps";
type ErrInvalidWeight = "Invalid weight";
type ErrInvalidWorkoutSet =
  | ErrInvalidSet
  | ErrInvalidTargetReps
  | ErrInvalidReps
  | ErrInvalidWeight;

export const WorkoutSet = {
  create(
    input: WorkoutSetCreateInput,
  ): Result<WorkoutSet, ErrInvalidWorkoutSet> {
    const workoutId =
      typeof input.workout === "string" ? input.workout : input.workout.id;

    const exerciseId =
      typeof input.exercise === "string" ? input.exercise : input.exercise.id;

    if (input.set <= 0) {
      console.error("Set number should be positive", { set: input.set });
      return err("Invalid set");
    }

    if (input.targetReps !== undefined && input.targetReps <= 0) {
      console.error("Target reps should be positive", {
        targetReps: input.targetReps,
      });
      return err("Invalid target reps");
    }

    if (input.reps !== undefined && input.reps <= 0) {
      console.error("Reps should be positive", {
        reps: input.reps,
      });
      return err("Invalid reps");
    }

    if (input.weight !== undefined && input.weight <= 0) {
      console.error("Weight should be positive", {
        weight: input.weight,
      });
      return err("Invalid weight");
    }

    return ok({
      workoutId,
      exerciseId,
      set: input.set,
      targetReps: input.targetReps,
      reps: input.reps,
      weight: input.weight,
      note: input.note,
      isCompleted: input.isCompleted ?? false,
      isFailure: input.isFailure ?? false,
    });
  },
};

export interface WorkoutExercise {
  readonly workoutId: Workout["id"];
  readonly exerciseId: Exercise["id"];
  readonly orderIndex: number;
  readonly notes?: string;
}

export interface WorkoutExerciseGroup {
  readonly exercise: Exercise;
  readonly sets: ReadonlyArray<WorkoutSet>;
  readonly notes?: string;
  readonly orderIndex: number;
}

export interface WorkoutSession {
  readonly workout: Workout;
  readonly exerciseGroups: ReadonlyArray<WorkoutExerciseGroup>;
}

interface WorkoutSessionCreateInput {
  readonly workout: Workout;
  readonly exercises: ReadonlyArray<{
    readonly exercise: Exercise;
    readonly orderIndex: number;
    readonly notes?: string;
  }>;
}

export const WorkoutSession = {
  create(input: WorkoutSessionCreateInput): WorkoutSession {
    return {
      workout: input.workout,
      exerciseGroups: input.exercises.map(
        ({ exercise, orderIndex, notes }) => ({
          exercise,
          sets: [],
          notes,
          orderIndex,
        }),
      ),
    };
  },

  addExercise(
    this: WorkoutSession,
    exercise: Exercise,
    notes?: string,
  ): WorkoutSession {
    const maxOrder = Math.max(
      ...this.exerciseGroups.map((g) => g.orderIndex),
      -1,
    );
    const newGroup: WorkoutExerciseGroup = {
      exercise,
      sets: [],
      notes,
      orderIndex: maxOrder + 1,
    };

    return {
      ...this,
      exerciseGroups: [...this.exerciseGroups, newGroup],
    };
  },

  removeExercise(
    this: WorkoutSession,
    exerciseId: Exercise["id"],
  ): WorkoutSession {
    return {
      ...this,
      exerciseGroups: this.exerciseGroups.filter(
        (group) => group.exercise.id !== exerciseId,
      ),
    };
  },

  addSet(
    this: WorkoutSession,
    exerciseId: Exercise["id"],
    set: Omit<WorkoutSet, "workoutId" | "exerciseId">,
  ): WorkoutSession {
    return {
      ...this,
      exerciseGroups: this.exerciseGroups.map((group) =>
        group.exercise.id === exerciseId
          ? {
              ...group,
              sets: [
                ...group.sets,
                { ...set, workoutId: this.workout.id, exerciseId },
              ],
            }
          : group,
      ),
    };
  },

  completeSet(
    this: WorkoutSession,
    exerciseId: Exercise["id"],
    setNumber: number,
  ): WorkoutSession {
    return {
      ...this,
      exerciseGroups: this.exerciseGroups.map((group) =>
        group.exercise.id === exerciseId
          ? {
              ...group,
              sets: group.sets.map((s) =>
                s.set === setNumber ? { ...s, isCompleted: true } : s,
              ),
            }
          : group,
      ),
    };
  },
};
