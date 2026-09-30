import type { WorkoutExerciseGroup } from "~/modules/fitness/domain/workout";

export interface WorkoutExerciseProgressViewModel {
  readonly id: string;
  readonly name: string;
  readonly equipment: string;
  readonly totalSets: number;
  readonly completedSets: number;
  readonly isCompleted: boolean;
}

export interface WorkoutProgressViewModel {
  readonly exercises: readonly WorkoutExerciseProgressViewModel[];
  readonly totalSets: number;
  readonly completedSets: number;
  readonly unfinishedSets: number;
  readonly allSetsCompleted: boolean;
  readonly percent: number;
}

export function createWorkoutProgressViewModel(
  groups: readonly WorkoutExerciseGroup[],
): WorkoutProgressViewModel {
  const exercises: readonly WorkoutExerciseProgressViewModel[] = groups.map(
    ({ exercise, sets }) => {
      const completedSets = sets.filter((set) => set.isCompleted).length;
      return {
        id: exercise.id,
        name: exercise.name,
        equipment: exercise.type,
        totalSets: sets.length,
        completedSets,
        isCompleted: sets.length > 0 && completedSets === sets.length,
      };
    },
  );
  const totalSets = exercises.reduce(
    (total, exercise) => total + exercise.totalSets,
    0,
  );
  const completedSets = exercises.reduce(
    (total, exercise) => total + exercise.completedSets,
    0,
  );
  return {
    exercises,
    totalSets,
    completedSets,
    unfinishedSets: totalSets - completedSets,
    allSetsCompleted: totalSets > 0 && completedSets === totalSets,
    percent: totalSets > 0 ? (completedSets / totalSets) * 100 : 0,
  };
}
