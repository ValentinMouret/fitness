import { and, desc, eq, isNull, sql, type InferSelectModel } from "drizzle-orm";
import { ResultAsync } from "neverthrow";
import { db } from "~/db";
import {
  exercises,
  workoutExercises,
  workouts,
  workoutSets,
} from "~/db/schema";
import { logger } from "~/logger.server";
import type { ErrRepository } from "~/repository";
import { executeQuery } from "~/repository.server";
import type {
  Exercise,
  Workout,
  WorkoutExerciseGroup,
  WorkoutSession,
  WorkoutSet,
} from "../domain/workout";

export const WorkoutRepository = {
  save(
    workout: Omit<Workout, "id"> | Workout,
  ): ResultAsync<Workout, ErrRepository> {
    const values = {
      name: workout.name,
      start: workout.start,
      stop: workout.stop ?? null,
      notes: workout.notes ?? null,
      imported_from_strong: workout.importedFromStrong ?? false,
    };

    if ("id" in workout) {
      return ResultAsync.fromPromise(
        db
          .update(workouts)
          .set({ ...values, updated_at: new Date() })
          .where(eq(workouts.id, workout.id))
          .returning(),
        (error) => {
          logger.error({ err: error }, "Error updating workout");
          return "database_error" as const;
        },
      ).andThen((records) =>
        records.length > 0
          ? ResultAsync.fromSafePromise(
              Promise.resolve(workoutRecordToDomain(records[0])),
            )
          : ResultAsync.fromPromise(
              Promise.reject(new Error("No records returned")),
              () => "database_error" as const,
            ),
      );
    }

    return ResultAsync.fromPromise(
      db.insert(workouts).values(values).returning(),
      (error) => {
        logger.error({ err: error }, "Error creating workout");
        return "database_error" as const;
      },
    ).andThen((records) =>
      records.length > 0
        ? ResultAsync.fromSafePromise(
            Promise.resolve(workoutRecordToDomain(records[0])),
          )
        : ResultAsync.fromPromise(
            Promise.reject(new Error("No records returned")),
            () => "database_error" as const,
          ),
    );
  },

  findById(id: string): ResultAsync<Workout | null, ErrRepository> {
    const query = db
      .select()
      .from(workouts)
      .where(and(eq(workouts.id, id), isNull(workouts.deleted_at)));

    return executeQuery(query, "findWorkoutById").map((records) => {
      if (records.length === 0) {
        return null;
      }

      return workoutRecordToDomain(records[0]);
    });
  },

  findAll(): ResultAsync<Workout[], ErrRepository> {
    const query = db
      .select()
      .from(workouts)
      .where(isNull(workouts.deleted_at))
      .orderBy(desc(workouts.start));

    return executeQuery(query, "findAllWorkouts").map((records) =>
      records.map(workoutRecordToDomain),
    );
  },

  findInProgress(): ResultAsync<Workout | null, ErrRepository> {
    const query = db
      .select()
      .from(workouts)
      .where(and(isNull(workouts.deleted_at), isNull(workouts.stop)))
      .orderBy(desc(workouts.start))
      .limit(1);

    return executeQuery(query, "findInProgressWorkout").map((records) => {
      if (records.length === 0) {
        return null;
      }
      return workoutRecordToDomain(records[0]);
    });
  },

  findAllWithPagination(
    page = 1,
    limit = 10,
  ): ResultAsync<{ workouts: Workout[]; totalCount: number }, ErrRepository> {
    const offset = (page - 1) * limit;

    const workoutsQuery = db
      .select()
      .from(workouts)
      .where(isNull(workouts.deleted_at))
      .orderBy(desc(workouts.start))
      .limit(limit)
      .offset(offset);

    const countQuery = db
      .select({ count: sql<number>`count(*)` })
      .from(workouts)
      .where(isNull(workouts.deleted_at));

    return ResultAsync.combine([
      executeQuery(workoutsQuery, "findWorkoutsWithPagination"),
      executeQuery(countQuery, "countWorkouts"),
    ]).map(([workoutRecords, countRecords]) => ({
      workouts: workoutRecords.map(workoutRecordToDomain),
      totalCount: countRecords[0]?.count ?? 0,
    }));
  },

  delete(id: string): ResultAsync<void, ErrRepository> {
    return ResultAsync.fromPromise(
      db.transaction(async (tx) => {
        // Soft delete workout sets
        await tx
          .update(workoutSets)
          .set({ deleted_at: new Date() })
          .where(eq(workoutSets.workout, id));

        // Soft delete workout exercises
        await tx
          .update(workoutExercises)
          .set({ deleted_at: new Date() })
          .where(eq(workoutExercises.workout_id, id));

        // Soft delete workout
        await tx
          .update(workouts)
          .set({ deleted_at: new Date() })
          .where(eq(workouts.id, id));
      }),
      (error) => {
        logger.error({ err: error }, "Error deleting workout");
        return "database_error" as const;
      },
    );
  },
};

export const WorkoutSessionRepository = {
  findById(
    workoutId: string,
  ): ResultAsync<WorkoutSession | null, ErrRepository> {
    const query = db
      .select()
      .from(workouts)
      .leftJoin(
        workoutExercises,
        and(
          eq(workouts.id, workoutExercises.workout_id),
          isNull(workoutExercises.deleted_at),
        ),
      )
      .leftJoin(exercises, eq(workoutExercises.exercise_id, exercises.id))
      .leftJoin(
        workoutSets,
        and(
          eq(workouts.id, workoutSets.workout),
          eq(workoutExercises.exercise_id, workoutSets.exercise),
          isNull(workoutSets.deleted_at),
        ),
      )
      .where(and(eq(workouts.id, workoutId), isNull(workouts.deleted_at)))
      .orderBy(workoutExercises.order_index, workoutSets.set);

    return executeQuery(query, "findWorkoutSessionById").map((records) => {
      if (records.length === 0) {
        return null;
      }

      const workout = workoutRecordToDomain(records[0].workouts);

      // Group by exercise
      const exerciseMap = new Map<
        string,
        {
          exercise: Exercise;
          orderIndex: number;
          notes?: string;
          sets: WorkoutSet[];
        }
      >();

      for (const record of records) {
        if (!record.workout_exercises || !record.exercises) {
          continue;
        }

        const exerciseId = record.exercises.id;

        if (!exerciseMap.has(exerciseId)) {
          exerciseMap.set(exerciseId, {
            exercise: exerciseRecordToDomain(record.exercises),
            orderIndex: record.workout_exercises.order_index,
            notes: record.workout_exercises.notes ?? undefined,
            sets: [],
          });
        }

        const exerciseData = exerciseMap.get(exerciseId);
        if (!exerciseData) continue;

        if (record.workout_sets) {
          const existingSet = exerciseData.sets.find(
            (s) => s.set === record.workout_sets?.set,
          );

          if (!existingSet) {
            const workoutSet = workoutSetRecordToDomain(record.workout_sets);
            // console.log(`[Workout Repository] Retrieved set from database...`);
            exerciseData.sets.push(workoutSet);
          }
        }
      }

      // Convert to exercise groups
      const exerciseGroups: WorkoutExerciseGroup[] = Array.from(
        exerciseMap.values(),
      )
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map(({ exercise, orderIndex, notes, sets }) => ({
          exercise,
          orderIndex,
          notes,
          sets: sets.sort((a, b) => a.set - b.set),
        }));

      return {
        workout,
        exerciseGroups,
      };
    });
  },

  addExercise(
    workoutId: string,
    exerciseId: string,
    orderIndex: number,
    notes?: string,
  ): ResultAsync<void, ErrRepository> {
    return ResultAsync.fromPromise(
      db.transaction(async (tx) => {
        await tx.insert(workoutExercises).values({
          workout_id: workoutId,
          exercise_id: exerciseId,
          order_index: orderIndex,
          notes: notes ?? null,
        });

        await tx.insert(workoutSets).values({
          workout: workoutId,
          exercise: exerciseId,
          set: 1,
          targetReps: null,
          reps: null,
          weight: null,
          note: null,
          isCompleted: false,
          isFailure: false,
          isWarmup: false,
        });
      }),
      (error) => {
        logger.error({ err: error }, "Error adding exercise to workout");
        return "database_error" as const;
      },
    ).map(() => undefined);
  },

  removeExercise(
    workoutId: string,
    exerciseId: string,
  ): ResultAsync<void, ErrRepository> {
    return ResultAsync.fromPromise(
      db.transaction(async (tx) => {
        // Soft delete all sets for this exercise in this workout
        await tx
          .update(workoutSets)
          .set({ deleted_at: new Date() })
          .where(
            and(
              eq(workoutSets.workout, workoutId),
              eq(workoutSets.exercise, exerciseId),
            ),
          );

        // Soft delete the workout exercise
        await tx
          .update(workoutExercises)
          .set({ deleted_at: new Date() })
          .where(
            and(
              eq(workoutExercises.workout_id, workoutId),
              eq(workoutExercises.exercise_id, exerciseId),
            ),
          );
      }),
      (error) => {
        logger.error({ err: error }, "Error removing exercise from workout");
        return "database_error" as const;
      },
    ).map(() => undefined);
  },

  addSet(workoutSet: WorkoutSet): ResultAsync<void, ErrRepository> {
    return ResultAsync.fromPromise(
      db
        .insert(workoutSets)
        .values({
          workout: workoutSet.workoutId,
          exercise: workoutSet.exerciseId,
          set: workoutSet.set,
          targetReps: workoutSet.targetReps ?? null,
          reps: workoutSet.reps ?? null,
          weight: workoutSet.weight ?? null,
          note: workoutSet.note ?? null,
          isCompleted: workoutSet.isCompleted,
          isFailure: workoutSet.isFailure,
          isWarmup: workoutSet.isWarmup,
        })
        .onConflictDoUpdate({
          target: [workoutSets.workout, workoutSets.exercise, workoutSets.set],
          set: {
            targetReps: workoutSet.targetReps ?? null,
            reps: workoutSet.reps ?? null,
            weight: workoutSet.weight ?? null,
            note: workoutSet.note ?? null,
            isCompleted: workoutSet.isCompleted,
            isFailure: workoutSet.isFailure,
            isWarmup: workoutSet.isWarmup,
            updated_at: new Date(),
            deleted_at: null, // Restore if it was soft deleted
          },
        }),
      (error) => {
        logger.error({ err: error }, "Error adding/updating set");
        return "database_error" as const;
      },
    ).map(() => undefined);
  },

  getNextAvailableSetNumber(
    workoutId: string,
    exerciseId: string,
  ): ResultAsync<number, ErrRepository> {
    const query = db
      .select({ set: workoutSets.set })
      .from(workoutSets)
      .where(
        and(
          eq(workoutSets.workout, workoutId),
          eq(workoutSets.exercise, exerciseId),
        ),
      )
      .orderBy(workoutSets.set);

    return executeQuery(query, "getNextAvailableSetNumber").map((records) => {
      if (records.length === 0) {
        return 1;
      }

      // Find the first gap in the sequence or return the next number after the highest
      const usedSetNumbers = records.map((r) => r.set);
      for (let i = 1; i <= usedSetNumbers.length + 1; i++) {
        if (!usedSetNumbers.includes(i)) {
          return i;
        }
      }

      // This shouldn't happen, but fallback to max + 1
      return Math.max(...usedSetNumbers) + 1;
    });
  },

  updateSet(
    workoutId: string,
    exerciseId: string,
    setNumber: number,
    updates: Partial<
      Pick<
        WorkoutSet,
        | "targetReps"
        | "reps"
        | "weight"
        | "note"
        | "isCompleted"
        | "isFailure"
        | "isWarmup"
      >
    >,
  ): ResultAsync<void, ErrRepository> {
    return ResultAsync.fromPromise(
      db
        .update(workoutSets)
        .set({
          targetReps: updates.targetReps ?? undefined,
          reps: updates.reps ?? undefined,
          weight: updates.weight ?? undefined,
          note: updates.note ?? undefined,
          isCompleted: updates.isCompleted ?? undefined,
          isFailure: updates.isFailure ?? undefined,
          isWarmup: updates.isWarmup ?? undefined,
          updated_at: new Date(),
        })
        .where(
          and(
            eq(workoutSets.workout, workoutId),
            eq(workoutSets.exercise, exerciseId),
            eq(workoutSets.set, setNumber),
            isNull(workoutSets.deleted_at),
          ),
        ),
      (error) => {
        logger.error({ err: error }, "Error updating set");
        return "database_error" as const;
      },
    ).map(() => undefined);
  },

  removeSet(
    workoutId: string,
    exerciseId: string,
    setNumber: number,
  ): ResultAsync<void, ErrRepository> {
    return ResultAsync.fromPromise(
      db
        .update(workoutSets)
        .set({ deleted_at: new Date() })
        .where(
          and(
            eq(workoutSets.workout, workoutId),
            eq(workoutSets.exercise, exerciseId),
            eq(workoutSets.set, setNumber),
          ),
        ),
      (error) => {
        logger.error({ err: error }, "Error removing set");
        return "database_error" as const;
      },
    ).map(() => undefined);
  },
};

function workoutRecordToDomain(
  record: InferSelectModel<typeof workouts>,
): Workout {
  return {
    id: record.id,
    name: record.name,
    start: record.start ?? new Date(),
    stop: record.stop ?? undefined,
    notes: record.notes ?? undefined,
    importedFromStrong: record.imported_from_strong ?? false,
  };
}

function exerciseRecordToDomain(
  record: InferSelectModel<typeof exercises>,
): Exercise {
  return {
    id: record.id,
    name: record.name,
    type: record.type,
    movementPattern: record.movement_pattern,
    description: record.description ?? undefined,
    mmcInstructions: record.mmc_instructions ?? undefined,
  };
}

function workoutSetRecordToDomain(
  record: InferSelectModel<typeof workoutSets>,
): WorkoutSet {
  return {
    workoutId: record.workout,
    exerciseId: record.exercise,
    set: record.set,
    targetReps: record.targetReps ?? undefined,
    reps: record.reps ?? undefined,
    weight: record.weight ?? undefined,
    note: record.note ?? undefined,
    isCompleted: record.isCompleted,
    isFailure: record.isFailure,
    isWarmup: record.isWarmup,
  };
}
