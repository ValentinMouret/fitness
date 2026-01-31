import { describe, it, expect, beforeEach } from "vitest";
import { ResultAsync } from "neverthrow";
import { importFitbodCSV } from "./fitbod-import.service.server";
import { importWorkout as importStrongWorkout } from "./strong-import.service.server";
import type { IWorkoutRepository } from "../infra/workout.repository.server";
import type { IExerciseRepository } from "../infra/repository.server";
import type { Workout, Exercise, WorkoutSession } from "../domain/workout";
import type { ErrRepository } from "~/repository";

class InMemoryWorkoutRepository implements IWorkoutRepository {
  workouts: Workout[] = [];
  savedSessions: WorkoutSession[] = [];

  save(
    workout: Omit<Workout, "id"> | Workout,
  ): ResultAsync<Workout, ErrRepository> {
    const id =
      "id" in workout ? workout.id : `workout-${this.workouts.length + 1}`;
    const newWorkout: Workout = { ...workout, id };
    this.workouts.push(newWorkout);
    return ResultAsync.fromPromise(
      Promise.resolve(newWorkout),
      () => "database_error",
    );
  }

  saveSession(
    workoutSession: WorkoutSession,
  ): ResultAsync<void, ErrRepository> {
    this.savedSessions.push(workoutSession);
    return ResultAsync.fromPromise(Promise.resolve(), () => "database_error");
  }

  findById(id: string): ResultAsync<Workout | null, ErrRepository> {
    return ResultAsync.fromPromise(
      Promise.resolve(this.workouts.find((w) => w.id === id) ?? null),
      () => "database_error",
    );
  }

  findAll(): ResultAsync<Workout[], ErrRepository> {
    return ResultAsync.fromPromise(
      Promise.resolve(this.workouts),
      () => "database_error",
    );
  }

  findAllWithPagination(
    page = 1,
    limit = 10,
  ): ResultAsync<{ workouts: Workout[]; totalCount: number }, ErrRepository> {
    const offset = (page - 1) * limit;
    const ordered = [...this.workouts].sort(
      (a, b) => b.start.getTime() - a.start.getTime(),
    );
    return ResultAsync.fromPromise(
      Promise.resolve({
        workouts: ordered.slice(offset, offset + limit),
        totalCount: ordered.length,
      }),
      () => "database_error",
    );
  }

  findInProgress(): ResultAsync<Workout | null, ErrRepository> {
    return ResultAsync.fromPromise(
      Promise.resolve(this.workouts.find((w) => !w.stop) ?? null),
      () => "database_error",
    );
  }

  delete(id: string): ResultAsync<void, ErrRepository> {
    this.workouts = this.workouts.filter((w) => w.id !== id);
    return ResultAsync.fromPromise(Promise.resolve(), () => "database_error");
  }
}

class InMemoryExerciseRepository implements IExerciseRepository {
  exercises: Exercise[] = [];

  listAll(): ResultAsync<ReadonlyArray<Exercise>, ErrRepository> {
    return ResultAsync.fromPromise(
      Promise.resolve(this.exercises),
      () => "database_error",
    );
  }

  create(exercise: Omit<Exercise, "id">): ResultAsync<Exercise, ErrRepository> {
    const newExercise: Exercise = {
      ...exercise,
      id: `exercise-${this.exercises.length + 1}`,
    };
    this.exercises.push(newExercise);
    return ResultAsync.fromPromise(
      Promise.resolve(newExercise),
      () => "database_error",
    );
  }

  save(exercise: Exercise): ResultAsync<void, ErrRepository> {
    const index = this.exercises.findIndex((e) => e.id === exercise.id);
    if (index >= 0) {
      this.exercises[index] = exercise;
    } else {
      this.exercises.push(exercise);
    }
    return ResultAsync.fromPromise(Promise.resolve(), () => "database_error");
  }
}

describe("Import Completion with InMemory Repositories", () => {
  let workoutRepo: InMemoryWorkoutRepository;
  let exerciseRepo: InMemoryExerciseRepository;

  beforeEach(() => {
    workoutRepo = new InMemoryWorkoutRepository();
    exerciseRepo = new InMemoryExerciseRepository();
  });

  describe("Fitbod Import", () => {
    it("should set stop date to 45 minutes after start date", async () => {
      const csvContent = `Date,Exercise,Reps,Weight(kg),Duration(s),Distance(m),isWarmup,Note
2026-01-22 06:00:00 +0000,Dumbbell Bench Press,10,20.0,0.0,0.0,false,`;

      const startTime = new Date("2026-01-22T06:00:00.000Z");
      const expectedStopTime = new Date(startTime.getTime() + 45 * 60 * 1000);

      const result = await importFitbodCSV(
        csvContent,
        { createMissingExercises: true, skipUnmappedExercises: false },
        { workoutRepository: workoutRepo, exerciseRepository: exerciseRepo },
      );

      expect(result.isOk()).toBe(true);
      expect(workoutRepo.workouts.length).toBe(1);
      const savedWorkout = workoutRepo.workouts[0];
      expect(savedWorkout.start.getTime()).toBe(startTime.getTime());
      expect(savedWorkout.stop?.getTime()).toBe(expectedStopTime.getTime());
    });
  });

  describe("Strong Import", () => {
    it("should set stop date to 45 minutes after start date", async () => {
      const strongText = `Afternoon Workout
Wednesday 13 August 2025 at 07:32

Bench Press (Barbell)
Set 1: 60 kg × 10`;

      const startTime = new Date(2025, 7, 13, 7, 32);
      const expectedStopTime = new Date(startTime.getTime() + 45 * 60 * 1000);

      const result = await importStrongWorkout(
        strongText,
        { createMissingExercises: true, skipUnmappedExercises: false },
        { workoutRepository: workoutRepo, exerciseRepository: exerciseRepo },
      );

      expect(result.isOk()).toBe(true);
      expect(workoutRepo.workouts.length).toBe(1);
      const savedWorkout = workoutRepo.workouts[0];
      expect(savedWorkout.start.getTime()).toBe(startTime.getTime());
      expect(savedWorkout.stop?.getTime()).toBe(expectedStopTime.getTime());
    });
  });
});
