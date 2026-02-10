import type { Exercise, WorkoutSession } from "./workout";

export interface WorkoutTemplateExercise {
  readonly exerciseId: string;
  readonly orderIndex: number;
  readonly notes?: string;
}

export interface WorkoutTemplateSet {
  readonly exerciseId: string;
  readonly set: number;
  readonly targetReps?: number;
  readonly weight?: number;
  readonly isWarmup: boolean;
}

export interface WorkoutTemplate {
  readonly id: string;
  readonly name: string;
  readonly sourceWorkoutId?: string;
  readonly exercises: ReadonlyArray<WorkoutTemplateExercise>;
  readonly sets: ReadonlyArray<WorkoutTemplateSet>;
}

export interface WorkoutTemplateWithDetails extends WorkoutTemplate {
  readonly exerciseDetails: ReadonlyArray<Exercise>;
  readonly usageCount: number;
  readonly lastUsedAt?: Date;
  readonly createdAt: Date;
}

interface CreateFromWorkoutInput {
  readonly name: string;
  readonly session: WorkoutSession;
}

export const WorkoutTemplate = {
  createFromWorkout(
    input: CreateFromWorkoutInput,
  ): Omit<WorkoutTemplate, "id"> {
    const exercises: WorkoutTemplateExercise[] =
      input.session.exerciseGroups.map((group) => ({
        exerciseId: group.exercise.id,
        orderIndex: group.orderIndex,
        notes: group.notes,
      }));

    const sets: WorkoutTemplateSet[] = input.session.exerciseGroups.flatMap(
      (group) =>
        group.sets.map((s) => ({
          exerciseId: group.exercise.id,
          set: s.set,
          targetReps: s.reps ?? s.targetReps,
          weight: s.weight,
          isWarmup: s.isWarmup,
        })),
    );

    return {
      name: input.name,
      sourceWorkoutId: input.session.workout.id,
      exercises,
      sets,
    };
  },
};
