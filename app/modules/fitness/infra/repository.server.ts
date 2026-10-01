import { and, eq, type InferSelectModel, isNull } from "drizzle-orm";
import _ from "lodash";
import { ResultAsync } from "neverthrow";
import { db as defaultDatabase } from "~/db";
import { exercisePreferences } from "~/db/schema";
import type { UserId } from "~/modules/auth/domain/user";
import { requireCatalogueOwner } from "./exercise-catalogue-owner.server";
import { projectExercisePreferences } from "./exercise-preferences.repository.server";
import { exerciseMuscleGroups, exercises } from "~/db/schema";
import { logger } from "~/logger.server";
import type { ErrRepository } from "~/repository";
import { executeQuery } from "~/repository.server";
import {
  type Exercise,
  type ExerciseMuscleGroups,
  ExerciseMuscleGroupsAggregate,
  type ExerciseType,
  type MuscleGroupSplit,
} from "../domain/workout";

export function createExerciseRepository(
  userId: UserId,
  database: typeof defaultDatabase = defaultDatabase,
) {
  return {
    listAll(): ResultAsync<ReadonlyArray<Exercise>, ErrRepository> {
      return executeQuery(
        database
          .select()
          .from(exercises)
          .where(isNull(exercises.deleted_at))
          .orderBy(exercises.name),
        "listAllExercises",
      ).andThen((rows) =>
        ResultAsync.fromPromise(
          projectExercisePreferences(
            userId,
            rows.map(exerciseRecordToDomain),
            database,
          ),
          () => "database_error" as const,
        ),
      );
    },
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
    description: undefined,
    mmcInstructions: undefined,
  };
}

interface Filters {
  type?: ExerciseType;
  q?: string;
}

export function createExerciseMuscleGroupsRepository(
  userId: UserId,
  database: typeof defaultDatabase = defaultDatabase,
) {
  const db = database;
  const project = (entry: ExerciseMuscleGroups | null) =>
    ResultAsync.fromPromise(
      entry
        ? projectExercisePreferences(userId, [entry.exercise], database).then(
            ([exercise]) => ({ ...entry, exercise }),
          )
        : Promise.resolve(null),
      () => "database_error" as const,
    );
  return {
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

      return executeQuery(query, "findById")
        .map((records) => {
          if (records.length === 0) {
            return null;
          }

          const exercise: Exercise = exerciseRecordToDomain(
            records[0].exercises,
          );
          const muscleGroupSplits = records.map((row) =>
            muscleGroupRecordToDomain(row.exercise_muscle_groups),
          );

          const result = ExerciseMuscleGroupsAggregate.create(
            exercise,
            muscleGroupSplits,
          );

          if (result.isErr()) {
            logger.error({ err: result.error }, "Error deserializing exercise");
            return null;
          }

          return result.value;
        })
        .andThen(project);
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

      return executeQuery(query, "findByName")
        .map((records) => {
          if (records.length === 0) {
            return null;
          }

          const exercise: Exercise = exerciseRecordToDomain(
            records[0].exercises,
          );
          const muscleGroupSplits = records.map((row) =>
            muscleGroupRecordToDomain(row.exercise_muscle_groups),
          );

          const result = ExerciseMuscleGroupsAggregate.create(
            exercise,
            muscleGroupSplits,
          );

          if (result.isErr()) {
            logger.error({ err: result.error }, "Error deserializing exercise");
            return null;
          }

          return result.value;
        })
        .andThen(project);
    },

    deleteById(exerciseId: string): ResultAsync<void, ErrRepository> {
      return ResultAsync.fromPromise(
        db.transaction(async (tx) => {
          await requireCatalogueOwner(userId, tx);
          await tx
            .update(exercises)
            .set({ deleted_at: new Date() })
            .where(eq(exercises.id, exerciseId));
        }),
        () => "database_error" as const,
      );
    },

    save({
      exercise,
      muscleGroupSplits,
    }: ExerciseMuscleGroups): ResultAsync<void, ErrRepository> {
      return ResultAsync.fromPromise(
        db.transaction(async (tx) => {
          await requireCatalogueOwner(userId, tx);
          // First try to find existing exercise
          const exerciseResult = await tx
            .select({ id: exercises.id })
            .from(exercises)
            .where(eq(exercises.id, exercise.id))
            .limit(1);

          let exerciseId: string;

          if (exerciseResult.length > 0) {
            // Update existing exercise
            exerciseId = exerciseResult[0].id;
            await tx
              .update(exercises)
              .set({
                name: exercise.name,
                type: exercise.type,
                movement_pattern: exercise.movementPattern,
                description: null,
                mmc_instructions: null,
                updated_at: new Date(),
              })
              .where(eq(exercises.id, exerciseId));
          } else {
            // Insert new exercise
            const insertResult = await tx
              .insert(exercises)
              .values({
                id: exercise.id,
                name: exercise.name,
                type: exercise.type,
                movement_pattern: exercise.movementPattern,
                description: null,
                mmc_instructions: null,
              })
              .returning({ id: exercises.id });
            exerciseId = insertResult[0].id;
          }

          await tx
            .insert(exercisePreferences)
            .values({
              userId,
              exerciseId,
              description: exercise.description ?? null,
              mmcInstructions: exercise.mmcInstructions ?? null,
            })
            .onConflictDoUpdate({
              target: [
                exercisePreferences.userId,
                exercisePreferences.exerciseId,
              ],
              set: {
                description: exercise.description ?? null,
                mmcInstructions: exercise.mmcInstructions ?? null,
                deleted_at: null,
                updated_at: new Date(),
              },
            });

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
        (error) => {
          logger.error(
            { err: error },
            "Failed to save exercise with muscle groups",
          );
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
        )
        .where(isNull(exercises.deleted_at));
      return executeQuery(query, "ListAll")
        .map((records) =>
          _(records)
            .groupBy((record) => record.exercises.id)
            .mapValues((rows) => {
              const exercise: Exercise = exerciseRecordToDomain(
                rows[0].exercises,
              );
              const muscleGroupSplits = rows.map((row) =>
                muscleGroupRecordToDomain(row.exercise_muscle_groups),
              );
              const result = ExerciseMuscleGroupsAggregate.create(
                exercise,
                muscleGroupSplits,
              );
              if (result.isErr()) {
                logger.error({ err: result.error }, "Error deserializing");
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
        )
        .andThen((entries) =>
          ResultAsync.fromPromise(
            projectExercisePreferences(
              userId,
              entries.map((entry) => entry.exercise),
              database,
            ).then((projected) =>
              entries.map((entry, index) => ({
                ...entry,
                exercise: projected[index],
              })),
            ),
            () => "database_error" as const,
          ),
        );
    },
  };
}

function muscleGroupRecordToDomain(
  record: InferSelectModel<typeof exerciseMuscleGroups>,
): MuscleGroupSplit {
  return {
    muscleGroup: record.muscle_group,
    split: record.split,
  };
}
