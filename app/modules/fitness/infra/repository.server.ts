import { db } from "~/db";
import _ from "lodash";
import {
  ExerciseMuscleGroupsAggregate,
  type Exercise,
  type ExerciseMuscleGroups,
  type ExerciseType,
  type MuscleGroupSplit,
} from "../domain/workout";
import { exerciseMuscleGroups, exercises } from "~/db/schema";
import { ResultAsync } from "neverthrow";
import type { ErrDatabase, ErrRepository } from "~/repository";
import { executeQuery } from "~/repository.server";
import { and, eq, type InferSelectModel } from "drizzle-orm";

export const ExerciseRepository = {
  listAll(): ResultAsync<ReadonlyArray<Exercise>, ErrDatabase> {
    const query = db.select().from(exercises).orderBy(exercises.name);
    return executeQuery(query, "listAllExercises").map((records) =>
      records.map((record) => exerciseRecordToDomain(record)),
    );
  },

  save(exercise: Exercise) {
    return ResultAsync.fromPromise(
      db
        .insert(exercises)
        .values({
          id: exercise.id,
          name: exercise.name,
          type: exercise.type,
          movement_pattern: exercise.movementPattern,
          description: exercise.description ?? null,
        })
        .onConflictDoUpdate({
          target: [exercises.name, exercises.type],
          set: {
            updated_at: new Date(),
            description: exercise.description ?? null,
            movement_pattern: exercise.movementPattern,
          },
        }),
      (err) => {
        console.error(err);
        return "database_error";
      },
    );
  },
};

function exerciseRecordToDomain(
  record: InferSelectModel<typeof exercises>,
): Exercise {
  return {
    id: record.id,
    name: record.name,
    type: record.type,
    movementPattern: record.movement_pattern,
    description: record.description ?? undefined,
  };
}

interface Filters {
  type?: ExerciseType;
  q?: string;
}

export const ExerciseMuscleGroupsRepository = {
  findById(
    id: string,
  ): ResultAsync<ExerciseMuscleGroups | null, ErrRepository> {
    const query = db
      .select()
      .from(exercises)
      .innerJoin(
        exerciseMuscleGroups,
        eq(exercises.id, exerciseMuscleGroups.exercise),
      )
      .where(eq(exercises.id, id));

    return executeQuery(query, "findById").map((records) => {
      if (records.length === 0) {
        return null;
      }

      const exercise: Exercise = exerciseRecordToDomain(records[0].exercises);
      const muscleGroupSplits = records.map((row) =>
        muscleGroupRecordToDomain(row.exercise_muscle_groups),
      );

      const result = ExerciseMuscleGroupsAggregate.create(
        exercise,
        muscleGroupSplits,
      );

      if (result.isErr()) {
        console.error("Error deserializing exercise", result);
        return null;
      }

      return result.value;
    });
  },

  findByNameAndType(
    name: string,
    type: ExerciseType,
  ): ResultAsync<ExerciseMuscleGroups | null, ErrRepository> {
    const query = db
      .select()
      .from(exercises)
      .innerJoin(
        exerciseMuscleGroups,
        eq(exercises.id, exerciseMuscleGroups.exercise),
      )
      .where(and(eq(exercises.name, name), eq(exercises.type, type)));

    return executeQuery(query, "findByName").map((records) => {
      if (records.length === 0) {
        return null;
      }

      const exercise: Exercise = exerciseRecordToDomain(records[0].exercises);
      const muscleGroupSplits = records.map((row) =>
        muscleGroupRecordToDomain(row.exercise_muscle_groups),
      );

      const result = ExerciseMuscleGroupsAggregate.create(
        exercise,
        muscleGroupSplits,
      );

      if (result.isErr()) {
        console.error("Error deserializing exercise", result);
        return null;
      }

      return result.value;
    });
  },

  deleteById(exerciseId: string): ResultAsync<void, ErrRepository> {
    return ResultAsync.fromPromise(
      db.transaction(async (tx) => {
        await tx
          .delete(exerciseMuscleGroups)
          .where(eq(exerciseMuscleGroups.exercise, exerciseId));
        await tx.delete(exercises).where(eq(exercises.id, exerciseId));
      }),
      (err) => {
        console.error(err);
        return "database_error";
      },
    );
  },

  delete(
    exerciseName: string,
    exerciseType: ExerciseType,
  ): ResultAsync<void, ErrRepository> {
    return ResultAsync.fromPromise(
      db.transaction(async (tx) => {
        // First find the exercise ID by name and type
        const exerciseRecord = await tx
          .select({ id: exercises.id })
          .from(exercises)
          .where(
            and(
              eq(exercises.name, exerciseName),
              eq(exercises.type, exerciseType),
            ),
          )
          .limit(1);

        if (exerciseRecord.length === 0) {
          throw new Error(
            `Exercise not found: ${exerciseName} (${exerciseType})`,
          );
        }

        const exerciseId = exerciseRecord[0].id;

        await tx
          .delete(exerciseMuscleGroups)
          .where(eq(exerciseMuscleGroups.exercise, exerciseId));
        await tx.delete(exercises).where(eq(exercises.id, exerciseId));
      }),
      (err) => {
        console.error(err);
        return "database_error";
      },
    );
  },

  save({
    exercise,
    muscleGroupSplits,
  }: ExerciseMuscleGroups): ResultAsync<void, ErrRepository> {
    return ResultAsync.fromPromise(
      db.transaction(async (tx) => {
        // First try to find existing exercise
        const exerciseResult = await tx
          .select({ id: exercises.id })
          .from(exercises)
          .where(
            and(
              eq(exercises.name, exercise.name),
              eq(exercises.type, exercise.type),
            ),
          )
          .limit(1);

        let exerciseId: string;

        if (exerciseResult.length > 0) {
          // Update existing exercise
          exerciseId = exerciseResult[0].id;
          await tx
            .update(exercises)
            .set({
              description: exercise.description,
              updated_at: new Date(),
            })
            .where(eq(exercises.id, exerciseId));
        } else {
          // Insert new exercise
          const insertResult = await tx
            .insert(exercises)
            .values({
              name: exercise.name,
              type: exercise.type,
              movement_pattern: exercise.movementPattern,
              description: exercise.description ?? null,
            })
            .returning({ id: exercises.id });
          exerciseId = insertResult[0].id;
        }

        // Delete existing muscle group mappings for this exercise
        await tx
          .delete(exerciseMuscleGroups)
          .where(eq(exerciseMuscleGroups.exercise, exerciseId));

        // Insert new muscle group mappings
        if (muscleGroupSplits.length > 0) {
          await tx.insert(exerciseMuscleGroups).values(
            muscleGroupSplits.map(({ muscleGroup, split }) => ({
              exercise: exerciseId,
              muscle_group: muscleGroup,
              split,
            })),
          );
        }
      }),
      (err) => {
        console.error(err);
        return "database_error";
      },
    );
  },
  // TODO(vm): move conditional filter to query
  listAll(
    filters: Filters = {},
  ): ResultAsync<ExerciseMuscleGroups[], ErrRepository> {
    const query = db
      .select()
      .from(exercises)
      .innerJoin(
        exerciseMuscleGroups,
        eq(exercises.id, exerciseMuscleGroups.exercise),
      );
    return executeQuery(query, "ListAll").map((records) =>
      _(records)
        .groupBy((record) => record.exercises.id)
        .mapValues((rows) => {
          const exercise: Exercise = exerciseRecordToDomain(rows[0].exercises);
          const muscleGroupSplits = rows.map((row) =>
            muscleGroupRecordToDomain(row.exercise_muscle_groups),
          );
          const result = ExerciseMuscleGroupsAggregate.create(
            exercise,
            muscleGroupSplits,
          );
          if (result.isErr()) {
            console.error("Error deserializing", result);
            return undefined;
          }
          return result.value;
        })
        .values()
        .filter((v) => v !== undefined)
        .filter((v) => {
          if (filters.type) {
            return v.exercise.type === filters.type;
          }
          if (filters.q) {
            return v.exercise.name
              .toLocaleLowerCase()
              .includes(filters.q.toLocaleLowerCase());
          }
          return true;
        })
        .value(),
    );
  },
};

function muscleGroupRecordToDomain(
  record: InferSelectModel<typeof exerciseMuscleGroups>,
): MuscleGroupSplit {
  return {
    muscleGroup: record.muscle_group,
    split: record.split,
  };
}
