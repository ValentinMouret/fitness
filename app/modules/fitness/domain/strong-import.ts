import { err, ok, type Result } from "neverthrow";
import type { ErrValidation } from "~/repository";

export const strongSetTypes = [
  "dropset",
  "failure",
  "regular",
  "warmup",
] as const;
export type StrongSetType = (typeof strongSetTypes)[number];

export interface StrongSet {
  readonly setNumber: number;
  readonly weight: number;
  readonly reps: number;
  readonly setType: StrongSetType;
  readonly note?: string;
}

export interface StrongExercise {
  readonly name: string;
  readonly sets: ReadonlyArray<StrongSet>;
}

export interface StrongWorkoutData {
  readonly name: string;
  readonly date: Date;
  readonly exercises: ReadonlyArray<StrongExercise>;
  readonly originalText: string; // Keep original for debugging
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

export const StrongSetType = {
  fromString(input: string): StrongSetType {
    // Warm-up sets are marked with W1, W2, etc. in Strong exports
    if (input.startsWith("W")) return "warmup";

    // For now, treat everything else as regular sets
    // TODO: Detect dropsets and failure sets from Strong format
    return "regular";
  },

  isWarmup(setType: StrongSetType): boolean {
    return setType === "warmup";
  },
};

export const StrongSet = {
  create(
    setNumber: number,
    weight: number,
    reps: number,
    setType: StrongSetType = "regular",
    note?: string,
  ): Result<StrongSet, ErrValidation> {
    if (setNumber <= 0) {
      return err("validation_error");
    }

    if (weight < 0) {
      return err("validation_error");
    }

    if (reps <= 0) {
      return err("validation_error");
    }

    return ok({
      setNumber,
      weight,
      reps,
      setType,
      note,
    });
  },
};

export const StrongExercise = {
  create(
    name: string,
    sets: ReadonlyArray<StrongSet>,
  ): Result<StrongExercise, ErrValidation> {
    if (name.trim().length === 0) {
      return err("validation_error");
    }

    if (sets.length === 0) {
      return err("validation_error");
    }

    return ok({
      name: name.trim(),
      sets,
    });
  },
};

export const StrongWorkoutData = {
  create(
    name: string,
    date: Date,
    exercises: ReadonlyArray<StrongExercise>,
    originalText: string,
  ): Result<StrongWorkoutData, ErrValidation> {
    if (name.trim().length === 0) {
      return err("validation_error");
    }

    if (exercises.length === 0) {
      return err("validation_error");
    }

    return ok({
      name: name.trim(),
      date,
      exercises,
      originalText,
    });
  },
};
