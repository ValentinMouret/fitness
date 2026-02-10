import { and, desc, eq, type InferSelectModel, isNull, sql } from "drizzle-orm";
import { ResultAsync } from "neverthrow";
import { db } from "~/db";
import {
  exercises,
  workoutExercises,
  workoutSets,
  workouts,
} from "~/db/schema";
import { logger } from "~/logger.server";
import type { ErrRepository } from "~/repository";
import { executeQuery } from "~/repository.server";
import type {
  Exercise,
  ExerciseHistoryPage,
  Workout,
  WorkoutExerciseGroup,
  WorkoutSession,
  WorkoutSet,
  WorkoutWithSummary,
} from "../domain/workout";
import { ExerciseHistorySession } from "../domain/workout";

export const WorkoutRepository: IWorkoutRepository = {
  save(
    workout: Omit<Workout, "id"> | Workout,
  ): ResultAsync<Workout, ErrRepository> {
    const values = {
      name: workout.name,
      start: workout.start,
      stop: workout.stop ?? null,
      notes: workout.notes ?? null,
      imported_from_strong: workout.importedFromStrong ?? false,
      imported_from_fitbod: workout.importedFromFitbod ?? false,
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
      .where(
        and(
          isNull(workouts.deleted_at),
          isNull(workouts.stop),
          eq(workouts.imported_from_fitbod, false),
          eq(workouts.imported_from_strong, false),
        ),
      )
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

  findAllWithSummary(
    page = 1,
    limit = 10,
  ): ResultAsync<
    { workouts: WorkoutWithSummary[]; totalCount: number },
    ErrRepository
  > {
    const offset = (page - 1) * limit;

    const summaryQuery = db
      .select({
        id: workouts.id,
        name: workouts.name,
        start: workouts.start,
        stop: workouts.stop,
        notes: workouts.notes,
        imported_from_strong: workouts.imported_from_strong,
        imported_from_fitbod: workouts.imported_from_fitbod,
        exerciseCount:
          sql<number>`count(distinct ${workoutExercises.exercise_id})`.as(
            "exercise_count",
          ),
        setCount:
          sql<number>`count(distinct (${workoutSets.exercise}, ${workoutSets.set}))`.as(
            "set_count",
          ),
        totalVolume:
          sql<number>`coalesce(sum(case when ${workoutSets.isCompleted} then ${workoutSets.reps} * ${workoutSets.weight} else 0 end), 0)`.as(
            "total_volume",
          ),
      })
      .from(workouts)
      .leftJoin(
        workoutExercises,
        and(
          eq(workouts.id, workoutExercises.workout_id),
          isNull(workoutExercises.deleted_at),
        ),
      )
      .leftJoin(
        workoutSets,
        and(
          eq(workouts.id, workoutSets.workout),
          isNull(workoutSets.deleted_at),
        ),
      )
      .where(isNull(workouts.deleted_at))
      .groupBy(workouts.id)
      .orderBy(desc(workouts.start))
      .limit(limit)
      .offset(offset);

    const countQuery = db
      .select({ count: sql<number>`count(*)` })
      .from(workouts)
      .where(isNull(workouts.deleted_at));

    return ResultAsync.combine([
      executeQuery(summaryQuery, "findWorkoutsWithSummary"),
      executeQuery(countQuery, "countWorkouts"),
    ]).map(([records, countRecords]) => ({
      workouts: records.map((r) => {
        const start = r.start ?? new Date();
        const stop = r.stop ?? undefined;
        const durationMinutes =
          stop && start
            ? Math.round((stop.getTime() - start.getTime()) / 60000)
            : undefined;
        return {
          id: r.id,
          name: r.name,
          start,
          stop,
          notes: r.notes ?? undefined,
          importedFromStrong: r.imported_from_strong ?? false,
          importedFromFitbod: r.imported_from_fitbod ?? false,
          exerciseCount: Number(r.exerciseCount) || 0,
          setCount: Number(r.setCount) || 0,
          durationMinutes,
          totalVolumeKg: Math.round(Number(r.totalVolume) || 0),
        };
      }),
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

  saveSession(
    workoutSession: WorkoutSession,
  ): ResultAsync<void, ErrRepository> {
    return ResultAsync.fromPromise(
      db.transaction(async (tx) => {
        for (const group of workoutSession.exerciseGroups) {
          await tx
            .insert(workoutExercises)
            .values({
              workout_id: workoutSession.workout.id,
              exercise_id: group.exercise.id,
              order_index: group.orderIndex,
              notes: group.notes ?? null,
            })
            .onConflictDoUpdate({
              target: [
                workoutExercises.workout_id,
                workoutExercises.exercise_id,
              ],
              set: {
                order_index: group.orderIndex,
                notes: group.notes ?? null,
                updated_at: new Date(),
                deleted_at: null,
              },
            });

          for (const set of group.sets) {
            await tx
              .insert(workoutSets)
              .values({
                workout: set.workoutId,
                exercise: set.exerciseId,
                set: set.set,
                targetReps: set.targetReps ?? null,
                reps: set.reps ?? null,
                weight: set.weight ?? null,
                note: set.note ?? null,
                isCompleted: set.isCompleted,
                isFailure: set.isFailure,
                isWarmup: set.isWarmup,
              })
              .onConflictDoUpdate({
                target: [
                  workoutSets.workout,
                  workoutSets.exercise,
                  workoutSets.set,
                ],
                set: {
                  targetReps: set.targetReps ?? null,
                  reps: set.reps ?? null,
                  weight: set.weight ?? null,
                  note: set.note ?? null,
                  isCompleted: set.isCompleted,
                  isFailure: set.isFailure,
                  isWarmup: set.isWarmup,
                  updated_at: new Date(),
                  deleted_at: null,
                },
              });
          }
        }
      }),
      (error) => {
        logger.error({ err: error }, "Error saving workout session");
        return "database_error" as const;
      },
    ).map(() => undefined);
  },
};

export interface IWorkoutRepository {
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
    defaultSetValues?: { reps?: number; weight?: number },
  ): ResultAsync<void, ErrRepository> {
    return ResultAsync.fromPromise(
      db.transaction(async (tx) => {
        await tx
          .insert(workoutExercises)
          .values({
            workout_id: workoutId,
            exercise_id: exerciseId,
            order_index: orderIndex,
            notes: notes ?? null,
          })
          .onConflictDoUpdate({
            target: [workoutExercises.workout_id, workoutExercises.exercise_id],
            set: {
              order_index: orderIndex,
              notes: notes ?? null,
              updated_at: new Date(),
              deleted_at: null,
            },
          });

        await tx
          .insert(workoutSets)
          .values({
            workout: workoutId,
            exercise: exerciseId,
            set: 1,
            targetReps: null,
            reps: defaultSetValues?.reps ?? null,
            weight: defaultSetValues?.weight ?? null,
            note: null,
            isCompleted: false,
            isFailure: false,
            isWarmup: false,
          })
          .onConflictDoUpdate({
            target: [
              workoutSets.workout,
              workoutSets.exercise,
              workoutSets.set,
            ],
            set: {
              targetReps: null,
              reps: defaultSetValues?.reps ?? null,
              weight: defaultSetValues?.weight ?? null,
              note: null,
              isCompleted: false,
              isFailure: false,
              isWarmup: false,
              updated_at: new Date(),
              deleted_at: null,
            },
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
          isNull(workoutSets.deleted_at),
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

  replaceExercise(
    workoutId: string,
    oldExerciseId: string,
    newExerciseId: string,
  ): ResultAsync<void, ErrRepository> {
    return ResultAsync.fromPromise(
      db.transaction(async (tx) => {
        // Get the current order_index and notes
        const existing = await tx
          .select({
            order_index: workoutExercises.order_index,
            notes: workoutExercises.notes,
          })
          .from(workoutExercises)
          .where(
            and(
              eq(workoutExercises.workout_id, workoutId),
              eq(workoutExercises.exercise_id, oldExerciseId),
              isNull(workoutExercises.deleted_at),
            ),
          );

        if (existing.length === 0) {
          throw new Error("Exercise not found in workout");
        }

        const { order_index, notes } = existing[0];

        // Soft delete old exercise's sets
        await tx
          .update(workoutSets)
          .set({ deleted_at: new Date() })
          .where(
            and(
              eq(workoutSets.workout, workoutId),
              eq(workoutSets.exercise, oldExerciseId),
            ),
          );

        // Soft delete old workout_exercise
        await tx
          .update(workoutExercises)
          .set({ deleted_at: new Date() })
          .where(
            and(
              eq(workoutExercises.workout_id, workoutId),
              eq(workoutExercises.exercise_id, oldExerciseId),
            ),
          );

        // Insert new workout_exercise at the same position
        await tx
          .insert(workoutExercises)
          .values({
            workout_id: workoutId,
            exercise_id: newExerciseId,
            order_index,
            notes,
          })
          .onConflictDoUpdate({
            target: [workoutExercises.workout_id, workoutExercises.exercise_id],
            set: {
              order_index,
              notes,
              updated_at: new Date(),
              deleted_at: null,
            },
          });

        // Add a default first set for the new exercise
        await tx
          .insert(workoutSets)
          .values({
            workout: workoutId,
            exercise: newExerciseId,
            set: 1,
            targetReps: null,
            reps: null,
            weight: null,
            note: null,
            isCompleted: false,
            isFailure: false,
            isWarmup: false,
          })
          .onConflictDoUpdate({
            target: [
              workoutSets.workout,
              workoutSets.exercise,
              workoutSets.set,
            ],
            set: {
              targetReps: null,
              reps: null,
              weight: null,
              note: null,
              isCompleted: false,
              isFailure: false,
              isWarmup: false,
              updated_at: new Date(),
              deleted_at: null,
            },
          });
      }),
      (error) => {
        logger.error({ err: error }, "Error replacing exercise in workout");
        return "database_error" as const;
      },
    ).map(() => undefined);
  },

  reorderExercises(
    workoutId: string,
    exerciseIds: ReadonlyArray<string>,
  ): ResultAsync<void, ErrRepository> {
    return ResultAsync.fromPromise(
      db.transaction(async (tx) => {
        for (let i = 0; i < exerciseIds.length; i++) {
          await tx
            .update(workoutExercises)
            .set({ order_index: i, updated_at: new Date() })
            .where(
              and(
                eq(workoutExercises.workout_id, workoutId),
                eq(workoutExercises.exercise_id, exerciseIds[i]),
                isNull(workoutExercises.deleted_at),
              ),
            );
        }
      }),
      (error) => {
        logger.error({ err: error }, "Error reordering exercises");
        return "database_error" as const;
      },
    ).map(() => undefined);
  },

  getExerciseHistory(
    exerciseId: string,
    cursor?: string,
    limit = 10,
  ): ResultAsync<ExerciseHistoryPage, ErrRepository> {
    const cursorDate = cursor ? new Date(cursor) : null;
    const cursorCondition = cursorDate
      ? sql`AND w.start < ${cursorDate}`
      : sql``;

    const query = sql`
      SELECT
        w.id      AS workout_id,
        w.name    AS workout_name,
        w.start   AS workout_date,
        ws.set,
        ws.reps,
        ws.weight,
        ws."isWarmup" AS is_warmup
      FROM workout_sets ws
      INNER JOIN workouts w ON ws.workout = w.id
      WHERE ws.exercise = ${exerciseId}
        AND w.stop IS NOT NULL
        AND ws."isCompleted" = true
        AND ws.deleted_at IS NULL
        AND w.deleted_at IS NULL
        ${cursorCondition}
      ORDER BY w.start DESC, ws.set ASC
    `;

    return ResultAsync.fromPromise(db.execute(query), (error) => {
      logger.error({ err: error }, "Error fetching exercise history");
      return "database_error" as const;
    }).map((result) => {
      const rows = result.rows as Array<{
        workout_id: string;
        workout_name: string;
        workout_date: Date;
        set: number;
        reps: number | null;
        weight: string | null;
        is_warmup: boolean;
      }>;

      // Group rows by workout
      const workoutMap = new Map<
        string,
        {
          workoutId: string;
          workoutName: string;
          date: Date;
          sets: Array<{
            set: number;
            reps?: number;
            weight?: number;
            isWarmup: boolean;
          }>;
        }
      >();

      for (const row of rows) {
        let entry = workoutMap.get(row.workout_id);
        if (!entry) {
          entry = {
            workoutId: row.workout_id,
            workoutName: row.workout_name,
            date:
              row.workout_date instanceof Date
                ? row.workout_date
                : new Date(row.workout_date),
            sets: [],
          };
          workoutMap.set(row.workout_id, entry);
        }
        entry.sets.push({
          set: row.set,
          reps: row.reps ?? undefined,
          weight: row.weight
            ? Number.parseFloat(row.weight as string)
            : undefined,
          isWarmup: row.is_warmup,
        });
      }

      const allSessions = Array.from(workoutMap.values()).map((entry) =>
        ExerciseHistorySession.fromSets(
          entry.workoutId,
          entry.workoutName,
          entry.date,
          entry.sets,
        ),
      );

      // Take limit + 1 to determine if there are more
      const sessions = allSessions.slice(0, limit);
      const hasMore = allSessions.length > limit;
      const nextCursor =
        hasMore && sessions.length > 0
          ? sessions[sessions.length - 1].date.toISOString()
          : undefined;

      return { sessions, nextCursor, hasMore };
    });
  },

  getLastCompletedSetsForExercise(
    exerciseId: string,
  ): ResultAsync<
    ReadonlyArray<{ set: number; reps?: number; weight?: number }>,
    ErrRepository
  > {
    const query = sql`
      SELECT ws.set, ws.reps, ws.weight
      FROM workout_sets ws
      INNER JOIN workouts w ON ws.workout = w.id
      WHERE ws.exercise = ${exerciseId}
        AND w.stop IS NOT NULL
        AND ws."isCompleted" = true
        AND ws."isWarmup" = false
        AND ws.deleted_at IS NULL
        AND w.deleted_at IS NULL
        AND w.id = (
          SELECT w2.id FROM workouts w2
          INNER JOIN workout_sets ws2 ON ws2.workout = w2.id
          WHERE ws2.exercise = ${exerciseId}
            AND w2.stop IS NOT NULL
            AND ws2.deleted_at IS NULL
            AND w2.deleted_at IS NULL
          ORDER BY w2.start DESC LIMIT 1
        )
      ORDER BY ws.set ASC
    `;

    return ResultAsync.fromPromise(db.execute(query), (error) => {
      logger.error(
        { err: error },
        "Error fetching last completed sets for exercise",
      );
      return "database_error" as const;
    }).map((result) =>
      (
        result.rows as Array<{
          set: number;
          reps: number | null;
          weight: string | null;
        }>
      ).map((row) => ({
        set: row.set,
        reps: row.reps ?? undefined,
        weight: row.weight ? Number.parseFloat(row.weight) : undefined,
      })),
    );
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
    importedFromFitbod: record.imported_from_fitbod ?? false,
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
