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

export type { ImportConfig, ImportResult } from "./strong-import";
