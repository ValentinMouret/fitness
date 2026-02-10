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

export const movementPatterns = [
  "push",
  "pull",
  "squat",
  "hinge",
  "core",
  "isolation",
  "rotation",
  "gait",
] as const;
export type MovementPattern = (typeof movementPatterns)[number];
export function parseMovementPattern(
  s: string,
): Result<MovementPattern, ErrValidation> {
  if (!movementPatterns.includes(s as MovementPattern))
    return err("validation_error");
  return ok(s as MovementPattern);
}

export interface Exercise {
  readonly id: string;
  readonly name: string;
  readonly type: ExerciseType;
  readonly movementPattern: MovementPattern;
  readonly description?: string;
  readonly mmcInstructions?: string;
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
  readonly importedFromStrong?: boolean;
  readonly importedFromFitbod?: boolean;
  readonly templateId?: string;
}

export interface WorkoutWithSummary extends Workout {
  readonly exerciseCount: number;
  readonly setCount: number;
  readonly durationMinutes?: number;
  readonly totalVolumeKg: number;
}

interface WorkoutCreateInput {
  readonly name: string;
  readonly start?: Date;
  readonly notes?: string;
  readonly importedFromStrong?: boolean;
  readonly importedFromFitbod?: boolean;
  readonly templateId?: string;
}

export const Workout = {
  create(input: WorkoutCreateInput): Omit<Workout, "id"> {
    return {
      name: input.name,
      start: input.start ?? new Date(),
      notes: input.notes,
      importedFromStrong: input.importedFromStrong ?? false,
      importedFromFitbod: input.importedFromFitbod ?? false,
      templateId: input.templateId,
    };
  },
  stop(this: Workout): Workout {
    return { ...this, stop: new Date() };
  },
  isComplete(this: Workout): boolean {
    return this.stop !== undefined;
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
  readonly isWarmup: boolean;
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
  readonly isWarmup?: boolean;
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
      return err("Invalid set");
    }

    if (input.targetReps !== undefined && input.targetReps <= 0) {
      return err("Invalid target reps");
    }

    if (input.reps !== undefined && input.reps <= 0) {
      return err("Invalid reps");
    }

    if (input.weight !== undefined && input.weight <= 0) {
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
      isWarmup: input.isWarmup ?? false,
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

  replaceExercise(
    this: WorkoutSession,
    exerciseId: Exercise["id"],
    newExercise: Exercise,
  ): WorkoutSession {
    return {
      ...this,
      exerciseGroups: this.exerciseGroups.map((group) =>
        group.exercise.id === exerciseId
          ? { ...group, exercise: newExercise }
          : group,
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

// Adaptive Workout Generation Domain

export interface EquipmentInstance {
  readonly id: string;
  readonly exerciseType: ExerciseType;
  readonly gymFloorId: string;
  readonly name: string;
  readonly capacity: number;
  readonly isAvailable: boolean;
}

export interface AdaptiveWorkoutRequest {
  readonly availableEquipment: ReadonlyArray<EquipmentInstance>;
  readonly targetDuration: number;
  readonly preferredFloor?: number;
  readonly volumeNeeds?: ReadonlyMap<MuscleGroup, number>;
}

export interface AdaptiveWorkoutResult {
  readonly workout: WorkoutSession;
  readonly alternatives: ReadonlyMap<Exercise["id"], ReadonlyArray<Exercise>>;
  readonly floorSwitches: number;
  readonly estimatedDuration: number;
}

export interface VolumeTarget {
  readonly muscleGroup: MuscleGroup;
  readonly minSets: number;
  readonly maxSets: number;
}

export interface WeeklyVolumeTracker {
  readonly weekStart: Date;
  readonly targets: ReadonlyArray<VolumeTarget>;
  readonly currentVolume: ReadonlyMap<MuscleGroup, number>;
  readonly remainingVolume: ReadonlyMap<MuscleGroup, number>;
}

export const OPTIMAL_MOVEMENT_SEQUENCE: ReadonlyArray<MovementPattern> = [
  "push",
  "pull",
  "squat",
  "core",
  "hinge",
  "isolation",
] as const;

export interface SequenceRecommendation {
  readonly nextPattern: MovementPattern;
  readonly confidence: number;
  readonly reasoning: string;
}

export const DEFAULT_VOLUME_TARGETS: ReadonlyArray<VolumeTarget> = [
  { muscleGroup: "pecs", minSets: 12, maxSets: 16 },
  { muscleGroup: "lats", minSets: 14, maxSets: 18 },
  { muscleGroup: "trapezes", minSets: 14, maxSets: 18 },
  { muscleGroup: "delts", minSets: 12, maxSets: 16 },
  { muscleGroup: "biceps", minSets: 8, maxSets: 12 },
  { muscleGroup: "triceps", minSets: 8, maxSets: 12 },
  { muscleGroup: "quads", minSets: 12, maxSets: 16 },
  { muscleGroup: "armstrings", minSets: 12, maxSets: 16 },
  { muscleGroup: "glutes", minSets: 12, maxSets: 16 },
  { muscleGroup: "calves", minSets: 8, maxSets: 12 },
  { muscleGroup: "abs", minSets: 6, maxSets: 10 },
] as const;

interface WeeklyVolumeTrackerCreateInput {
  readonly weekStart?: Date;
  readonly targets?: ReadonlyArray<VolumeTarget>;
  readonly currentVolume?: ReadonlyMap<MuscleGroup, number>;
}

export const WeeklyVolumeTracker = {
  create(input: WeeklyVolumeTrackerCreateInput = {}): WeeklyVolumeTracker {
    const weekStart = input.weekStart ?? new Date();
    const targets = input.targets ?? DEFAULT_VOLUME_TARGETS;
    const currentVolume = input.currentVolume ?? new Map();

    const remainingVolume = new Map<MuscleGroup, number>();
    for (const target of targets) {
      const current = currentVolume.get(target.muscleGroup) ?? 0;
      const remaining = Math.max(0, target.minSets - current);
      remainingVolume.set(target.muscleGroup, remaining);
    }

    return {
      weekStart,
      targets,
      currentVolume,
      remainingVolume,
    };
  },

  updateVolume(
    this: WeeklyVolumeTracker,
    muscleGroupVolumes: ReadonlyMap<MuscleGroup, number>,
  ): WeeklyVolumeTracker {
    const newCurrentVolume = new Map(this.currentVolume);

    for (const [muscleGroup, volume] of muscleGroupVolumes) {
      const current = newCurrentVolume.get(muscleGroup) ?? 0;
      newCurrentVolume.set(muscleGroup, current + volume);
    }

    return WeeklyVolumeTracker.create({
      weekStart: this.weekStart,
      targets: this.targets,
      currentVolume: newCurrentVolume,
    });
  },

  getVolumeNeeds(this: WeeklyVolumeTracker): ReadonlyMap<MuscleGroup, number> {
    return this.remainingVolume;
  },
};

export const MovementPatternSequencer = {
  getNextPattern(
    currentSequence: ReadonlyArray<MovementPattern>,
  ): SequenceRecommendation {
    if (currentSequence.length === 0) {
      return {
        nextPattern: OPTIMAL_MOVEMENT_SEQUENCE[0],
        confidence: 1.0,
        reasoning: "Starting with first pattern in optimal sequence",
      };
    }

    const lastPattern = currentSequence[currentSequence.length - 1];
    const currentIndex = OPTIMAL_MOVEMENT_SEQUENCE.indexOf(lastPattern);

    if (currentIndex === -1) {
      return {
        nextPattern: OPTIMAL_MOVEMENT_SEQUENCE[0],
        confidence: 0.7,
        reasoning: "Previous pattern not in optimal sequence, restarting",
      };
    }

    const nextIndex = (currentIndex + 1) % OPTIMAL_MOVEMENT_SEQUENCE.length;
    const nextPattern = OPTIMAL_MOVEMENT_SEQUENCE[nextIndex];

    return {
      nextPattern,
      confidence: 0.9,
      reasoning: `Following optimal sequence after ${lastPattern}`,
    };
  },

  validateSequence(sequence: ReadonlyArray<MovementPattern>): {
    isOptimal: boolean;
    score: number;
  } {
    if (sequence.length === 0) {
      return { isOptimal: true, score: 1.0 };
    }

    let score = 0;
    for (let i = 0; i < sequence.length; i++) {
      const pattern = sequence[i];
      const expectedIndex = i % OPTIMAL_MOVEMENT_SEQUENCE.length;
      const expectedPattern = OPTIMAL_MOVEMENT_SEQUENCE[expectedIndex];

      if (pattern === expectedPattern) {
        score += 1;
      }
    }

    const finalScore = score / sequence.length;
    return {
      isOptimal: finalScore >= 0.8,
      score: finalScore,
    };
  },
};
