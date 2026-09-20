import { isDeepStrictEqual } from "node:util";
import {
  and,
  desc,
  eq,
  type InferSelectModel,
  inArray,
  isNull,
  sql,
} from "drizzle-orm";
import {
  err,
  errAsync,
  ok,
  okAsync,
  type Result,
  ResultAsync,
} from "neverthrow";
import { db } from "~/db";
import {
  exerciseMuscleGroups,
  exercises,
  workoutExercises,
  workoutSets,
  workouts,
} from "~/db/schema";
import { logger } from "~/logger.server";
import type { ErrRepository } from "~/repository";
import { executeQuery } from "~/repository.server";
import type { IWorkoutRepository } from "../application/workout.repository";
import { workoutOperations } from "../application/workout-operations";
import type {
  Exercise,
  ExerciseHistoryPage,
  Workout,
  WorkoutExerciseGroup,
  WorkoutSession,
  WorkoutSet,
  WorkoutWithSummary,
} from "../domain/workout";
import {
  ExerciseHistorySession,
  ExerciseMuscleGroupsAggregate,
} from "../domain/workout";
import { failure, type WorkoutError } from "../domain/workout-commands";

type ExerciseHistoryRow = {
  readonly workout_id: string;
  readonly workout_name: string;
  readonly workout_date: Date;
  readonly set: number;
  readonly reps: number | null;
  readonly weight: string | null;
  readonly is_warmup: boolean;
  readonly rpe: number | null;
};

type LastCompletedSetRow = {
  readonly set: number;
  readonly reps: number | null;
  readonly weight: string | null;
};

type Database = typeof db;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

function databaseError(error: unknown): WorkoutError {
  logger.error({ err: error }, "Workout operation failed");
  const cause = error instanceof Error && error.cause ? error.cause : error;
  if (
    typeof cause === "object" &&
    cause !== null &&
    "code" in cause &&
    cause.code === "23505"
  )
    return failure(
      "conflict",
      "A record with this identifier or exercise name/type already exists",
    );
  return failure("database_error", "Could not save the workout data");
}

async function catalogue(
  tx: Transaction,
  ids: readonly string[],
  includeArchived = false,
): Promise<readonly Exercise[]> {
  if (!ids.length) return [];
  const rows = await tx
    .select()
    .from(exercises)
    .where(
      and(
        inArray(exercises.id, [...ids]),
        includeArchived ? undefined : isNull(exercises.deleted_at),
      ),
    )
    .for("share");
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    type: row.type,
    movementPattern: row.movement_pattern,
    description: row.description ?? undefined,
    mmcInstructions: row.mmc_instructions ?? undefined,
  }));
}

async function loadSession(
  tx: Transaction,
  id: string,
): Promise<WorkoutSession | null> {
  const [row] = await tx
    .select()
    .from(workouts)
    .where(and(eq(workouts.id, id), isNull(workouts.deleted_at)))
    .for("update");
  if (!row) return null;
  const groups = await tx
    .select()
    .from(workoutExercises)
    .where(
      and(
        eq(workoutExercises.workout_id, id),
        isNull(workoutExercises.deleted_at),
      ),
    )
    .orderBy(workoutExercises.order_index);
  const entries = await catalogue(
    tx,
    groups.map((group) => group.exercise_id),
    true,
  );
  const sets = await tx
    .select()
    .from(workoutSets)
    .where(and(eq(workoutSets.workout, id), isNull(workoutSets.deleted_at)))
    .orderBy(workoutSets.set);
  return {
    workout: {
      id: row.id,
      name: row.name,
      start: row.start ?? row.created_at,
      stop: row.stop ?? undefined,
      notes: row.notes ?? undefined,
      importedFromStrong: row.imported_from_strong,
      importedFromFitbod: row.imported_from_fitbod,
      templateId: row.template_id ?? undefined,
    },
    exerciseGroups: groups.flatMap((group) => {
      const exercise = entries.find((entry) => entry.id === group.exercise_id);
      return exercise
        ? [
            {
              exercise,
              orderIndex: group.order_index,
              notes: group.notes ?? undefined,
              sets: sets
                .filter((set) => set.exercise === group.exercise_id)
                .map((set) => ({
                  workoutId: id,
                  exerciseId: set.exercise,
                  set: set.set,
                  targetReps: set.targetReps ?? undefined,
                  reps: set.reps ?? undefined,
                  weight: set.weight ?? undefined,
                  note: set.note ?? undefined,
                  rpe: set.rpe ?? undefined,
                  isCompleted: set.isCompleted,
                  isWarmup: set.isWarmup,
                  isFailure: set.isFailure,
                })),
            },
          ]
        : [];
    }),
  };
}

async function persist(
  tx: Transaction,
  session: WorkoutSession,
  previous?: WorkoutSession,
) {
  const { workout, exerciseGroups } = session;
  const changedAt = new Date();
  if (!previous) {
    await tx.insert(workouts).values({
      id: workout.id,
      name: workout.name,
      start: workout.start,
      stop: workout.stop ?? null,
      notes: workout.notes ?? null,
    });
  } else if (!isDeepStrictEqual(workout, previous.workout)) {
    await tx
      .update(workouts)
      .set({ stop: workout.stop ?? null, updated_at: changedAt })
      .where(eq(workouts.id, workout.id));
  }
  const oldGroups = new Map(
    previous?.exerciseGroups.map((group) => [group.exercise.id, group]) ?? [],
  );
  const removed = [...oldGroups.keys()].filter(
    (id) => !exerciseGroups.some((group) => group.exercise.id === id),
  );
  const moved = exerciseGroups
    .filter(
      (group) =>
        oldGroups.has(group.exercise.id) &&
        oldGroups.get(group.exercise.id)?.orderIndex !== group.orderIndex,
    )
    .map((group) => group.exercise.id);
  // Release changed order positions before restoring them in this transaction.
  if (removed.length || moved.length) {
    await tx
      .update(workoutExercises)
      .set({ deleted_at: changedAt })
      .where(
        and(
          eq(workoutExercises.workout_id, workout.id),
          inArray(workoutExercises.exercise_id, [...removed, ...moved]),
        ),
      );
  }
  if (removed.length) {
    await tx
      .update(workoutSets)
      .set({ deleted_at: changedAt })
      .where(
        and(
          eq(workoutSets.workout, workout.id),
          inArray(workoutSets.exercise, removed),
          isNull(workoutSets.deleted_at),
        ),
      );
  }
  for (const group of exerciseGroups) {
    const before = oldGroups.get(group.exercise.id);
    if (
      !before ||
      before.orderIndex !== group.orderIndex ||
      before.notes !== group.notes
    ) {
      const values = {
        workout_id: workout.id,
        exercise_id: group.exercise.id,
        order_index: group.orderIndex,
        notes: group.notes ?? null,
      };
      await tx
        .insert(workoutExercises)
        .values(values)
        .onConflictDoUpdate({
          target: [workoutExercises.workout_id, workoutExercises.exercise_id],
          set: { ...values, deleted_at: null, updated_at: changedAt },
        });
    }
    const oldSets = new Map(before?.sets.map((set) => [set.set, set]) ?? []);
    const removedSets = [...oldSets.keys()].filter(
      (number) => !group.sets.some((set) => set.set === number),
    );
    if (removedSets.length) {
      await tx
        .update(workoutSets)
        .set({ deleted_at: changedAt })
        .where(
          and(
            eq(workoutSets.workout, workout.id),
            eq(workoutSets.exercise, group.exercise.id),
            inArray(workoutSets.set, removedSets),
          ),
        );
    }
    const changedSets = group.sets.filter(
      (set) => !isDeepStrictEqual(set, oldSets.get(set.set)),
    );
    if (changedSets.length) {
      const values = changedSets.map((set) => ({
        workout: workout.id,
        exercise: group.exercise.id,
        set: set.set,
        targetReps: set.targetReps ?? null,
        reps: set.reps ?? null,
        weight: set.weight ?? null,
        note: set.note ?? null,
        rpe: set.rpe ?? null,
        isCompleted: set.isCompleted,
        isWarmup: set.isWarmup,
        isFailure: set.isFailure,
      }));
      await tx
        .insert(workoutSets)
        .values(values)
        .onConflictDoUpdate({
          target: [workoutSets.workout, workoutSets.exercise, workoutSets.set],
          set: {
            targetReps: sql`excluded."targetReps"`,
            reps: sql`excluded.reps`,
            weight: sql`excluded.weight`,
            note: sql`excluded.note`,
            rpe: sql`excluded.rpe`,
            isCompleted: sql`excluded."isCompleted"`,
            isWarmup: sql`excluded."isWarmup"`,
            isFailure: sql`excluded."isFailure"`,
            deleted_at: null,
            updated_at: changedAt,
          },
        });
    }
  }
}

export function createWorkoutRepository(
  database: Database = db,
): IWorkoutRepository {
  function transaction<T>(
    run: (tx: Transaction) => Promise<Result<T, WorkoutError>>,
  ): ResultAsync<T, WorkoutError> {
    return ResultAsync.fromPromise(
      database.transaction(run),
      databaseError,
    ).andThen((result) => result);
  }
  const repository: IWorkoutRepository = {
    createSession: (build, ids) =>
      transaction(async (tx) => {
        const result = build(await catalogue(tx, ids));
        if (result.isErr()) return result;
        await persist(tx, result.value);
        return result;
      }),
    changeSession: (id, change, ids = []) =>
      transaction(async (tx) => {
        const session = await loadSession(tx, id);
        if (!session)
          return err(failure("not_found", "Workout does not exist"));
        const result = change(session, await catalogue(tx, ids));
        if (result.isErr()) return result;
        await persist(tx, result.value, session);
        return result;
      }),
    deleteSession: (id) =>
      transaction(async (tx) => {
        const session = await loadSession(tx, id);
        if (!session)
          return err(failure("not_found", "Workout does not exist"));
        const deleted_at = new Date();
        await tx
          .update(workouts)
          .set({ deleted_at })
          .where(eq(workouts.id, id));
        await tx
          .update(workoutExercises)
          .set({ deleted_at })
          .where(eq(workoutExercises.workout_id, id));
        await tx
          .update(workoutSets)
          .set({ deleted_at })
          .where(eq(workoutSets.workout, id));
        return ok({ workoutId: id });
      }),
    createExercise: (input) =>
      transaction(async (tx) => {
        const exercise = {
          id: crypto.randomUUID(),
          name: input.name,
          type: input.type,
          movementPattern: input.movementPattern,
          description: input.description ?? undefined,
          mmcInstructions: input.mmcInstructions ?? undefined,
        };
        const aggregate = ExerciseMuscleGroupsAggregate.create(
          exercise,
          input.muscleGroupSplits,
        );
        if (aggregate.isErr())
          return err(failure("invalid_input", aggregate.error));
        await tx.insert(exercises).values({
          id: exercise.id,
          name: exercise.name,
          type: exercise.type,
          movement_pattern: exercise.movementPattern,
          description: exercise.description,
          mmc_instructions: exercise.mmcInstructions,
        });
        await tx.insert(exerciseMuscleGroups).values(
          input.muscleGroupSplits.map((group) => ({
            exercise: exercise.id,
            muscle_group: group.muscleGroup,
            split: group.split,
          })),
        );
        return ok(aggregate.value);
      }),

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
        template_id: workout.templateId ?? null,
      };

      if ("id" in workout) {
        return ResultAsync.fromPromise(
          database
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
        database.insert(workouts).values(values).returning(),
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
      const query = database
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
      const query = database
        .select()
        .from(workouts)
        .where(isNull(workouts.deleted_at))
        .orderBy(desc(workouts.start));

      return executeQuery(query, "findAllWorkouts").map((records) =>
        records.map(workoutRecordToDomain),
      );
    },

    findInProgress(): ResultAsync<Workout | null, ErrRepository> {
      const query = database
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

      const workoutsQuery = database
        .select()
        .from(workouts)
        .where(isNull(workouts.deleted_at))
        .orderBy(desc(workouts.start))
        .limit(limit)
        .offset(offset);

      const countQuery = database
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

      const summaryQuery = database
        .select({
          id: workouts.id,
          name: workouts.name,
          start: workouts.start,
          stop: workouts.stop,
          notes: workouts.notes,
          imported_from_strong: workouts.imported_from_strong,
          imported_from_fitbod: workouts.imported_from_fitbod,
          template_id: workouts.template_id,
          exerciseCount:
            sql<number>`count(distinct ${workoutExercises.exercise_id})`.as(
              "exercise_count",
            ),
          setCount:
            sql<number>`count(distinct (${workoutSets.exercise}, ${workoutSets.set}))`.as(
              "set_count",
            ),
          totalVolume:
            sql<number>`coalesce((select sum(s.volume_kg) from fitness_data.sets s where s.workout_id = ${workouts.id}), 0)`.as(
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
            eq(workoutExercises.exercise_id, workoutSets.exercise),
            isNull(workoutSets.deleted_at),
          ),
        )
        .where(isNull(workouts.deleted_at))
        .groupBy(workouts.id)
        .orderBy(desc(workouts.start))
        .limit(limit)
        .offset(offset);

      const countQuery = database
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
            templateId: r.template_id ?? undefined,
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
      return repository
        .deleteSession(id)
        .map(() => undefined)
        .orElse((error) =>
          error.code === "not_found"
            ? okAsync(undefined)
            : errAsync("database_error" as const),
        );
    },

    saveSession(
      workoutSession: WorkoutSession,
    ): ResultAsync<void, ErrRepository> {
      return ResultAsync.fromPromise(
        database.transaction(async (tx) => {
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
                  rpe: set.rpe ?? null,
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
                    rpe: set.rpe ?? null,
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
  return repository;
}

export const WorkoutRepository = createWorkoutRepository();
export const workoutCommands = workoutOperations(WorkoutRepository);

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
    notes?: string,
    defaultSetValues?: { reps?: number; weight?: number },
  ): ResultAsync<void, ErrRepository> {
    return workoutCommands
      .addExercise({
        workoutId,
        exerciseId,
        notes,
        sets: [
          {
            set: 1,
            isCompleted: false,
            isWarmup: false,
            isFailure: false,
            reps: defaultSetValues?.reps,
            weight: defaultSetValues?.weight,
          },
        ],
      })
      .map(() => undefined)
      .mapErr(() => "database_error" as const);
  },

  removeExercise(
    workoutId: string,
    exerciseId: string,
  ): ResultAsync<void, ErrRepository> {
    return workoutCommands
      .removeExercise({ workoutId, exerciseId })
      .map(() => undefined)
      .mapErr(() => "database_error" as const);
  },

  addSet(workoutSet: WorkoutSet): ResultAsync<void, ErrRepository> {
    return workoutCommands
      .saveSets({
        workoutId: workoutSet.workoutId,
        exerciseId: workoutSet.exerciseId,
        sets: [
          {
            set: workoutSet.set,
            targetReps: workoutSet.targetReps,
            reps: workoutSet.reps,
            weight: workoutSet.weight,
            note: workoutSet.note,
            rpe: workoutSet.rpe,
            isCompleted: workoutSet.isCompleted,
            isWarmup: workoutSet.isWarmup,
            isFailure: workoutSet.isFailure,
          },
        ],
      })
      .map(() => undefined)
      .mapErr(() => "database_error" as const);
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
        | "rpe"
      >
    >,
  ): ResultAsync<void, ErrRepository> {
    return workoutCommands
      .updateSet({ workoutId, exerciseId, set: setNumber, updates })
      .map(() => undefined)
      .mapErr(() => "database_error" as const);
  },

  removeSet(
    workoutId: string,
    exerciseId: string,
    setNumber: number,
  ): ResultAsync<void, ErrRepository> {
    return workoutCommands
      .deleteSets({ workoutId, exerciseId, sets: [setNumber] })
      .map(() => undefined)
      .mapErr(() => "database_error" as const);
  },

  replaceExercise(
    workoutId: string,
    oldExerciseId: string,
    newExerciseId: string,
  ): ResultAsync<void, ErrRepository> {
    return workoutCommands
      .replaceExercise({ workoutId, oldExerciseId, newExerciseId })
      .map(() => undefined)
      .mapErr(() => "database_error" as const);
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

  updateExerciseNotes(
    workoutId: string,
    exerciseId: string,
    notes: string | null,
  ): ResultAsync<void, ErrRepository> {
    const query = db
      .update(workoutExercises)
      .set({ notes, updated_at: new Date() })
      .where(
        and(
          eq(workoutExercises.workout_id, workoutId),
          eq(workoutExercises.exercise_id, exerciseId),
          isNull(workoutExercises.deleted_at),
        ),
      );

    return executeQuery(query, "updateExerciseNotes").map(() => undefined);
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
        ws."isWarmup" AS is_warmup,
        ws.rpe
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

    return ResultAsync.fromPromise(
      db.execute<ExerciseHistoryRow>(query),
      (error) => {
        logger.error({ err: error }, "Error fetching exercise history");
        return "database_error" as const;
      },
    ).map((result) => {
      const rows = result.rows;

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
            rpe?: number;
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
          weight: row.weight ? Number.parseFloat(row.weight) : undefined,
          isWarmup: row.is_warmup,
          rpe: row.rpe ?? undefined,
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

    return ResultAsync.fromPromise(
      db.execute<LastCompletedSetRow>(query),
      (error) => {
        logger.error(
          { err: error },
          "Error fetching last completed sets for exercise",
        );
        return "database_error" as const;
      },
    ).map((result) =>
      result.rows.map((row) => ({
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
    templateId: record.template_id ?? undefined,
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
    rpe: record.rpe ?? undefined,
  };
}
