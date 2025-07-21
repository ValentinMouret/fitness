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
import { eq, sql, type InferSelectModel } from "drizzle-orm";

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
        .values(exercise)
        .onConflictDoUpdate({
          target: exercises.name,
          set: {
            updated_at: new Date(),
            description: exercise.description ?? null,
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
    name: record.name,
    type: record.type,
    description: record.description ?? undefined,
  };
}

interface Filters {
  type?: ExerciseType;
  q?: string;
}

export const ExerciseMuscleGroupsRepository = {
  save({ exercise, muscleGroupSplits }: ExerciseMuscleGroups) {
    return ResultAsync.fromPromise(
      db.transaction(async (tx) => {
        await tx
          .insert(exercises)
          .values(exercise)
          .onConflictDoUpdate({
            target: exercises.name,
            set: {
              ...exercise,
              updated_at: new Date(),
            },
          });

        await tx
          .insert(exerciseMuscleGroups)
          .values(
            muscleGroupSplits.map(({ muscleGroup, split }) => ({
              exercise: exercise.name,
              muscle_group: muscleGroup,
              split,
            })),
          )
          .onConflictDoUpdate({
            target: [
              exerciseMuscleGroups.exercise,
              exerciseMuscleGroups.muscle_group,
            ],
            set: {
              split: sql.raw(`excluded.${exerciseMuscleGroups.split.name}`),
              updated_at: sql`current_timestamp`,
            },
          });
      }),
      (err) => {
        console.error(err);
        return "err_database";
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
        eq(exercises.name, exerciseMuscleGroups.exercise),
      );
    return executeQuery(query, "ListAll").map((records) =>
      _(records)
        .groupBy((record) => record.exercises.name)
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
