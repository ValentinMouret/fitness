export interface FitbodSet {
  readonly weight: number;
  readonly reps: number;
  readonly isWarmup: boolean;
  readonly note?: string;
}

export interface FitbodExercise {
  readonly name: string;
  readonly sets: ReadonlyArray<FitbodSet>;
}

export interface FitbodWorkoutData {
  readonly date: Date;
  readonly exercises: ReadonlyArray<FitbodExercise>;
}

export interface ImportConfig {
  readonly overrideImportTime?: Date;
  readonly createMissingExercises: boolean;
  readonly skipUnmappedExercises: boolean;
}

export interface ImportResult {
  readonly workoutId: string;
  readonly exercisesCreated: ReadonlyArray<string>;
  readonly unmappedExercises: ReadonlyArray<string>;
  readonly warnings: ReadonlyArray<string>;
}
