/** Domain types for AI workout generation. */

import { z } from "zod";

export interface GeneratedExerciseSet {
  readonly setNumber: number;
  readonly targetReps: number;
  readonly targetWeight: number;
  readonly isWarmup: boolean;
  readonly restSeconds: number;
}

export interface GeneratedExercise {
  readonly exerciseId: string;
  readonly exerciseName: string;
  readonly sets: ReadonlyArray<GeneratedExerciseSet>;
  readonly notes?: string;
}

export interface GeneratedWorkout {
  readonly name: string;
  readonly rationale: string;
  readonly estimatedDuration: number;
  readonly exercises: ReadonlyArray<GeneratedExercise>;
  readonly sessionNotes?: string;
}

export interface TrainingPreference {
  readonly id: string;
  readonly content: string;
  readonly source: "refinement" | "manual";
  readonly createdAt: Date;
}

export interface ConversationMessage {
  readonly role: "user" | "assistant";
  readonly content: string;
}

export const ConversationMessageSchema: z.ZodType<ConversationMessage> =
  z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string(),
  });

export interface GenerationConversation {
  readonly id: string;
  readonly workoutId?: string;
  readonly messages: ReadonlyArray<ConversationMessage>;
  readonly contextSnapshot: Record<string, unknown>;
  readonly model: string;
  readonly totalTokens: number;
  readonly createdAt: Date;
}

/** Context assembled from training history and sent to the LLM. */
export interface GenerationContext {
  readonly recentWorkouts: ReadonlyArray<WorkoutSummary>;
  readonly volumeStats: ReadonlyArray<MuscleGroupVolumeStats>;
  readonly exerciseProgressions: ReadonlyArray<ExerciseProgression>;
  readonly availableExercises: ReadonlyArray<ExerciseCatalogEntry>;
  readonly preferences: ReadonlyArray<string>;
  readonly timeConstraintMinutes?: number;
}

export const GenerationContextSchema: z.ZodType<GenerationContext> = z.object({
  recentWorkouts: z.array(
    z.object({
      date: z.string(),
      name: z.string(),
      durationMinutes: z.number().optional(),
      exercises: z.array(
        z.object({
          name: z.string(),
          muscleGroups: z.array(z.string()),
          sets: z.array(
            z.object({
              reps: z.number().optional(),
              weight: z.number().optional(),
              rpe: z.number().optional(),
              isWarmup: z.boolean(),
            }),
          ),
        }),
      ),
    }),
  ),
  volumeStats: z.array(
    z.object({
      muscleGroup: z.string(),
      currentWeekSets: z.number(),
      targetMinSets: z.number(),
      targetMaxSets: z.number(),
      remainingSets: z.number(),
    }),
  ),
  exerciseProgressions: z.array(
    z.object({
      exerciseName: z.string(),
      recentSessions: z.array(
        z.object({
          date: z.string(),
          bestWeight: z.number(),
          bestReps: z.number(),
          avgRpe: z.number().optional(),
          estimatedOneRepMax: z.number(),
        }),
      ),
      trend: z.enum(["improving", "stable", "declining"]),
    }),
  ),
  availableExercises: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      type: z.string(),
      movementPattern: z.string(),
      muscleGroups: z.array(
        z.object({
          name: z.string(),
          split: z.number(),
        }),
      ),
    }),
  ),
  preferences: z.array(z.string()),
  timeConstraintMinutes: z.number().optional(),
});

export interface WorkoutSummary {
  readonly date: string;
  readonly name: string;
  readonly durationMinutes?: number;
  readonly exercises: ReadonlyArray<{
    readonly name: string;
    readonly muscleGroups: ReadonlyArray<string>;
    readonly sets: ReadonlyArray<{
      readonly reps?: number;
      readonly weight?: number;
      readonly rpe?: number;
      readonly isWarmup: boolean;
    }>;
  }>;
}

export interface MuscleGroupVolumeStats {
  readonly muscleGroup: string;
  readonly currentWeekSets: number;
  readonly targetMinSets: number;
  readonly targetMaxSets: number;
  readonly remainingSets: number;
}

export interface ExerciseProgression {
  readonly exerciseName: string;
  readonly recentSessions: ReadonlyArray<{
    readonly date: string;
    readonly bestWeight: number;
    readonly bestReps: number;
    readonly avgRpe?: number;
    readonly estimatedOneRepMax: number;
  }>;
  readonly trend: "improving" | "stable" | "declining";
}

export interface ExerciseCatalogEntry {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly movementPattern: string;
  readonly muscleGroups: ReadonlyArray<{
    readonly name: string;
    readonly split: number;
  }>;
}
