import type { Result, ResultAsync } from "neverthrow";
import type { ErrRepository } from "~/repository";
import type {
  Exercise,
  ExerciseMuscleGroups,
  Workout,
  WorkoutSession,
  WorkoutWithSummary,
} from "../domain/workout";
import type { CreateExercise, WorkoutError } from "../domain/workout-commands";

export interface IWorkoutRepository {
  readonly createSession: (
    build: (
      catalogue: readonly Exercise[],
    ) => Result<WorkoutSession, WorkoutError>,
    exerciseIds: readonly string[],
  ) => ResultAsync<WorkoutSession, WorkoutError>;
  readonly changeSession: (
    id: string,
    change: (
      session: WorkoutSession,
      catalogue: readonly Exercise[],
    ) => Result<WorkoutSession, WorkoutError>,
    exerciseIds?: readonly string[],
  ) => ResultAsync<WorkoutSession, WorkoutError>;
  readonly deleteSession: (
    id: string,
  ) => ResultAsync<{ readonly workoutId: string }, WorkoutError>;
  readonly createExercise: (
    input: CreateExercise,
  ) => ResultAsync<ExerciseMuscleGroups, WorkoutError>;

  save(
    workout: Omit<Workout, "id"> | Workout,
  ): ResultAsync<Workout, ErrRepository>;
  saveSession(workoutSession: WorkoutSession): ResultAsync<void, ErrRepository>;
  findById(id: string): ResultAsync<Workout | null, ErrRepository>;
  findAll(): ResultAsync<Workout[], ErrRepository>;
  findAllWithPagination(
    page?: number,
    limit?: number,
  ): ResultAsync<{ workouts: Workout[]; totalCount: number }, ErrRepository>;
  findAllWithSummary(
    page?: number,
    limit?: number,
  ): ResultAsync<
    { workouts: WorkoutWithSummary[]; totalCount: number },
    ErrRepository
  >;
  findInProgress(): ResultAsync<Workout | null, ErrRepository>;
  delete(id: string): ResultAsync<void, ErrRepository>;
}
