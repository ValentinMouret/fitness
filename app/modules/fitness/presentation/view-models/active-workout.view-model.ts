import type {
  ExerciseType,
  ReportedRir,
  WorkoutSession,
} from "~/modules/fitness/domain/workout";

/** Serializable workout state returned by the loader. */
export interface ActiveSetState {
  readonly setNumber: number;
  readonly targetReps?: number;
  readonly reps?: number;
  readonly weight?: number;
  readonly isWarmup: boolean;
  readonly isCompleted: boolean;
  readonly reportedRir?: ReportedRir;
  /** Effort recorded as RPE before RIR reports existed. */
  readonly legacyRpe?: number;
}

export interface ActiveExerciseState {
  readonly id: string;
  readonly name: string;
  readonly type: ExerciseType;
  readonly mmcInstructions?: string;
  readonly sets: ReadonlyArray<ActiveSetState>;
}

export interface ActiveWorkoutState {
  readonly id: string;
  readonly name: string;
  readonly start: string;
  readonly stop?: string;
  readonly exercises: ReadonlyArray<ActiveExerciseState>;
}

/** A pending change to one set; `null` clears a value. */
export interface SetPatch {
  readonly exerciseId: string;
  readonly setNumber: number;
  readonly removed?: boolean;
  readonly reps?: number | null;
  readonly weight?: number | null;
  readonly reportedRir?: ReportedRir | null;
  readonly isCompleted?: boolean;
  readonly isWarmup?: boolean;
}

export type ExerciseProgressStatus = "pending" | "active" | "done";

/** A value shown in a set cell: what was logged, or the plan when nothing was. */
export interface SetValueViewModel {
  readonly value?: number;
  /** The planned value, logged when the set is ticked without an entry. */
  readonly target?: number;
  readonly display: string;
  readonly isTarget: boolean;
}

export interface ActiveSetViewModel {
  readonly setNumber: number;
  /** "W" for warm-ups; working sets are numbered from 1. */
  readonly label: string;
  readonly isWarmup: boolean;
  readonly isCompleted: boolean;
  readonly isNext: boolean;
  readonly reps: SetValueViewModel;
  readonly weight: SetValueViewModel;
  readonly reportedRir?: ReportedRir;
  /** "RPE" when only a legacy RPE was recorded. */
  readonly effortLabel: "RIR" | "RPE";
  readonly rirDisplay: string;
}

export interface ActiveExerciseViewModel {
  readonly id: string;
  readonly name: string;
  readonly type: ExerciseType;
  readonly isBodyweight: boolean;
  readonly mmcInstructions?: string;
  readonly status: ExerciseProgressStatus;
  readonly completedSets: number;
  readonly totalSets: number;
  readonly sets: ReadonlyArray<ActiveSetViewModel>;
}

export interface ActiveWorkoutViewModel {
  readonly id: string;
  readonly name: string;
  readonly start: string;
  readonly stop?: string;
  readonly completedSets: number;
  readonly totalSets: number;
  readonly completedExercises: number;
  readonly exercises: ReadonlyArray<ActiveExerciseViewModel>;
}

export function toActiveWorkoutState(
  session: WorkoutSession,
): ActiveWorkoutState {
  return {
    id: session.workout.id,
    name: session.workout.name,
    start: session.workout.start.toISOString(),
    stop: session.workout.stop?.toISOString(),
    exercises: [...session.exerciseGroups]
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((group) => ({
        id: group.exercise.id,
        name: group.exercise.name,
        type: group.exercise.type,
        mmcInstructions: group.exercise.mmcInstructions,
        sets: group.sets.map((set) => ({
          setNumber: set.set,
          targetReps: set.targetReps,
          reps: set.reps,
          weight: set.weight,
          isWarmup: set.isWarmup,
          isCompleted: set.isCompleted,
          reportedRir: set.reportedRir,
          legacyRpe: set.rpe,
        })),
      })),
  };
}

const patchValue = <T>(
  current: T | undefined,
  patch: T | null | undefined,
): T | undefined => (patch === undefined ? current : (patch ?? undefined));

function applyPatch(set: ActiveSetState, patch: SetPatch): ActiveSetState {
  return {
    ...set,
    reps: patchValue(set.reps, patch.reps),
    weight: patchValue(set.weight, patch.weight),
    reportedRir:
      patch.isWarmup || patch.isCompleted === false
        ? undefined
        : patchValue(set.reportedRir, patch.reportedRir),
    isCompleted: patch.isCompleted ?? set.isCompleted,
    isWarmup: patch.isWarmup ?? set.isWarmup,
  };
}

/** Shows submitted changes before the server confirms them. */
export function applySetPatches(
  state: ActiveWorkoutState,
  patches: ReadonlyArray<SetPatch>,
): ActiveWorkoutState {
  if (patches.length === 0) return state;
  return {
    ...state,
    exercises: state.exercises.map((exercise) => {
      const relevant = patches.filter((p) => p.exerciseId === exercise.id);
      if (relevant.length === 0) return exercise;
      return {
        ...exercise,
        sets: exercise.sets.flatMap((set) => {
          const own = relevant.filter((p) => p.setNumber === set.setNumber);
          if (own.some((p) => p.removed)) return [];
          return [own.reduce(applyPatch, set)];
        }),
      };
    }),
  };
}

export function formatRir(rir: ReportedRir | undefined): string {
  if (rir === undefined) return "–";
  return rir === "unsure" ? "?" : rir;
}

export function setLabels(
  sets: ReadonlyArray<{ readonly isWarmup: boolean }>,
): ReadonlyArray<string> {
  let working = 0;
  return sets.map((set) => (set.isWarmup ? "W" : String(++working)));
}

function createRepsViewModel(set: ActiveSetState): SetValueViewModel {
  if (set.reps !== undefined)
    return {
      value: set.reps,
      target: set.targetReps,
      display: String(set.reps),
      isTarget: false,
    };
  return {
    target: set.targetReps,
    display: set.targetReps === undefined ? "–" : String(set.targetReps),
    isTarget: !set.isCompleted && set.targetReps !== undefined,
  };
}

function createWeightViewModel(
  set: ActiveSetState,
  isBodyweight: boolean,
): SetValueViewModel {
  if (set.weight === undefined)
    return { display: isBodyweight ? "BW" : "–", isTarget: false };
  return { value: set.weight, display: String(set.weight), isTarget: false };
}

function createExerciseViewModel(
  exercise: ActiveExerciseState,
): ActiveExerciseViewModel {
  const isBodyweight = exercise.type === "bodyweight";
  const labels = setLabels(exercise.sets);
  const next = exercise.sets.findIndex((set) => !set.isCompleted);
  const completedSets = exercise.sets.filter((set) => set.isCompleted).length;
  const totalSets = exercise.sets.length;
  return {
    id: exercise.id,
    name: exercise.name,
    type: exercise.type,
    isBodyweight,
    mmcInstructions: exercise.mmcInstructions,
    status:
      totalSets > 0 && completedSets === totalSets
        ? "done"
        : completedSets > 0
          ? "active"
          : "pending",
    completedSets,
    totalSets,
    sets: exercise.sets.map((set, index) => ({
      setNumber: set.setNumber,
      label: labels[index],
      isWarmup: set.isWarmup,
      isCompleted: set.isCompleted,
      isNext: index === next,
      reps: createRepsViewModel(set),
      weight: createWeightViewModel(set, isBodyweight),
      reportedRir: set.reportedRir,
      ...(set.reportedRir === undefined && set.legacyRpe !== undefined
        ? { effortLabel: "RPE" as const, rirDisplay: String(set.legacyRpe) }
        : {
            effortLabel: "RIR" as const,
            rirDisplay: formatRir(set.reportedRir),
          }),
    })),
  };
}

export function createActiveWorkoutViewModel(
  state: ActiveWorkoutState,
): ActiveWorkoutViewModel {
  const exercises = state.exercises.map(createExerciseViewModel);
  return {
    id: state.id,
    name: state.name,
    start: state.start,
    stop: state.stop,
    completedSets: exercises.reduce((sum, e) => sum + e.completedSets, 0),
    totalSets: exercises.reduce((sum, e) => sum + e.totalSets, 0),
    completedExercises: exercises.filter((e) => e.status === "done").length,
    exercises,
  };
}
