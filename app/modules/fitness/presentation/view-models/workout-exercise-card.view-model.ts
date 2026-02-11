import type {
  ExerciseType,
  WorkoutExerciseGroup,
  WorkoutSet,
} from "~/modules/fitness/domain/workout";

export interface WorkoutSetViewModel {
  readonly set: number;
  readonly reps?: number;
  readonly weight?: number;
  readonly note?: string;
  readonly rpe?: number;
  readonly isCompleted: boolean;
  readonly isFailure: boolean;
  readonly isWarmup: boolean;
  readonly repsDisplay: string;
  readonly weightDisplay: string;
  readonly noteDisplay: string;
}

export interface WorkoutExerciseCardViewModel {
  readonly exerciseId: string;
  readonly exerciseName: string;
  readonly exerciseType: ExerciseType;
  readonly sets: ReadonlyArray<WorkoutSetViewModel>;
  readonly notes?: string;
  readonly mmcInstructions?: string;
  readonly totalVolumeDisplay: string;
  readonly lastSet?: WorkoutSetViewModel;
  readonly canAddSets: boolean;
  readonly canRemoveExercise: boolean;
  readonly hasCompletedSets: boolean;
}

function createWorkoutSetViewModel(set: WorkoutSet): WorkoutSetViewModel {
  return {
    set: set.set,
    reps: set.reps,
    weight: set.weight,
    note: set.note,
    rpe: set.rpe,
    isCompleted: set.isCompleted,
    isFailure: set.isFailure,
    isWarmup: set.isWarmup,
    repsDisplay: set.reps?.toString() ?? "—",
    weightDisplay: set.weight?.toString() ?? "—",
    noteDisplay: set.note ?? "—",
  };
}

function calculateTotalVolumeDisplay(sets: ReadonlyArray<WorkoutSet>): string {
  const totalVolume = sets
    .filter((set) => set.isCompleted && set.reps && set.weight)
    .reduce((sum, set) => sum + (set.reps ?? 0) * (set.weight ?? 0), 0);

  return totalVolume > 0 ? `${totalVolume} kg` : "";
}

export function createWorkoutExerciseCardViewModel(
  exerciseGroup: WorkoutExerciseGroup,
  isWorkoutComplete = false,
): WorkoutExerciseCardViewModel {
  // console.log(`[View Model] Creating view model...`);

  const setViewModels = exerciseGroup.sets.map(createWorkoutSetViewModel);
  const lastSet = setViewModels[setViewModels.length - 1];
  const hasCompletedSets = exerciseGroup.sets.some((set) => set.isCompleted);

  return {
    exerciseId: exerciseGroup.exercise.id,
    exerciseName: exerciseGroup.exercise.name,
    exerciseType: exerciseGroup.exercise.type,
    sets: setViewModels,
    notes: exerciseGroup.notes,
    mmcInstructions: exerciseGroup.exercise.mmcInstructions,
    totalVolumeDisplay: calculateTotalVolumeDisplay(exerciseGroup.sets),
    lastSet,
    canAddSets: !isWorkoutComplete,
    canRemoveExercise: !isWorkoutComplete,
    hasCompletedSets,
  };
}
