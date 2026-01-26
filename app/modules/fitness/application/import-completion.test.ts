import { describe, it, expect, beforeEach } from "vitest";
import { ResultAsync, ok } from "neverthrow";
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
    return ResultAsync.fromSafePromise(Promise.resolve(ok(newWorkout)));
  }

  saveSession(
    workoutSession: WorkoutSession,
  ): ResultAsync<void, ErrRepository> {
    this.savedSessions.push(workoutSession);
    return ResultAsync.fromSafePromise(Promise.resolve(ok(undefined)));
  }

  findById(id: string): ResultAsync<Workout | null, ErrRepository> {
    return ResultAsync.fromSafePromise(
      Promise.resolve(ok(this.workouts.find((w) => w.id === id) ?? null)),
    );
  }

  findAll(): ResultAsync<Workout[], ErrRepository> {
    return ResultAsync.fromSafePromise(Promise.resolve(ok(this.workouts)));
  }

  findInProgress(): ResultAsync<Workout | null, ErrRepository> {
    return ResultAsync.fromSafePromise(
      Promise.resolve(ok(this.workouts.find((w) => !w.stop) ?? null)),
    );
  }

  delete(id: string): ResultAsync<void, ErrRepository> {
    this.workouts = this.workouts.filter((w) => w.id !== id);
    return ResultAsync.fromSafePromise(Promise.resolve(ok(undefined)));
  }
}

class InMemoryExerciseRepository implements IExerciseRepository {
  exercises: Exercise[] = [];

  listAll(): ResultAsync<ReadonlyArray<Exercise>, ErrRepository> {
    return ResultAsync.fromSafePromise(Promise.resolve(ok(this.exercises)));
  }

  create(exercise: Omit<Exercise, "id">): ResultAsync<Exercise, ErrRepository> {
    const newExercise: Exercise = {
      ...exercise,
      id: `exercise-${this.exercises.length + 1}`,
    };
    this.exercises.push(newExercise);
    return ResultAsync.fromSafePromise(Promise.resolve(ok(newExercise)));
  }

  save(exercise: Exercise): ResultAsync<void, ErrRepository> {
    const index = this.exercises.findIndex((e) => e.id === exercise.id);
    if (index >= 0) {
      this.exercises[index] = exercise;
    } else {
      this.exercises.push(exercise);
    }
    return ResultAsync.fromSafePromise(Promise.resolve(ok(undefined)));
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
