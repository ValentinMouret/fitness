import { and, eq, gte, type InferSelectModel, isNull } from "drizzle-orm";
import { ResultAsync } from "neverthrow";
import { db } from "~/db";
import {
  equipmentInstances,
  equipmentPreferences,
  exerciseMuscleGroups,
  exerciseSubstitutions,
  exercises,
} from "~/db/schema";
import { logger } from "~/logger.server";
import type {
  EquipmentInstance,
  ExerciseMuscleGroups,
} from "~/modules/fitness/domain/workout";
import { ExerciseMuscleGroupsAggregate } from "~/modules/fitness/domain/workout";
import type { ErrRepository } from "~/repository";
import { executeQuery } from "~/repository.server";

export const AdaptiveWorkoutRepository = {
  getAvailableEquipment(): ResultAsync<
    ReadonlyArray<EquipmentInstance>,
    ErrRepository
  > {
    const query = db
      .select()
      .from(equipmentInstances)
      .where(
        and(
          eq(equipmentInstances.is_available, true),
          isNull(equipmentInstances.deleted_at),
        ),
      );

    return executeQuery(query, "getAvailableEquipment").map((records) =>
      records.map((record) => equipmentInstanceRecordToDomain(record)),
    );
  },

  updateEquipmentAvailability(
    equipmentId: string,
    isAvailable: boolean,
  ): ResultAsync<void, ErrRepository> {
    return ResultAsync.fromPromise(
      db
        .update(equipmentInstances)
        .set({
          is_available: isAvailable,
          updated_at: new Date(),
        })
        .where(eq(equipmentInstances.id, equipmentId)),
      (error) => {
        logger.error({ err: error }, "Failed to update equipment availability");
        return "database_error" as const;
      },
    ).map(() => undefined);
  },

  findSubstitutes(
    exerciseId: string,
  ): ResultAsync<ReadonlyArray<ExerciseMuscleGroups>, ErrRepository> {
    const query = db
      .select({
        exercises,
        exercise_muscle_groups: exerciseMuscleGroups,
        substitution: exerciseSubstitutions,
      })
      .from(exerciseSubstitutions)
      .innerJoin(
        exercises,
        eq(exerciseSubstitutions.substitute_exercise_id, exercises.id),
      )
      .innerJoin(
        exerciseMuscleGroups,
        eq(exercises.id, exerciseMuscleGroups.exercise),
      )
      .where(
        and(
          eq(exerciseSubstitutions.primary_exercise_id, exerciseId),
          gte(exerciseSubstitutions.similarity_score, 0.7),
          gte(exerciseSubstitutions.muscle_overlap_percentage, 80),
          isNull(exercises.deleted_at),
        ),
      )
      .orderBy(exerciseSubstitutions.similarity_score);

    return executeQuery(query, "findSubstitutes").map((records) => {
      const exerciseGroups = new Map<
        string,
        {
          exercise: InferSelectModel<typeof exercises>;
          muscleGroups: InferSelectModel<typeof exerciseMuscleGroups>[];
        }
      >();

      for (const record of records) {
        const exerciseId = record.exercises.id;
        if (!exerciseGroups.has(exerciseId)) {
          exerciseGroups.set(exerciseId, {
            exercise: record.exercises,
            muscleGroups: [],
          });
        }
        exerciseGroups
          .get(exerciseId)
          ?.muscleGroups.push(record.exercise_muscle_groups);
      }

      const results: ExerciseMuscleGroups[] = [];
      for (const { exercise, muscleGroups } of exerciseGroups.values()) {
        const exerciseObject = {
          id: exercise.id,
          name: exercise.name,
          type: exercise.type,
          movementPattern: exercise.movement_pattern,
          description: exercise.description ?? undefined,
        };

        const muscleGroupSplits = muscleGroups.map((mg) => ({
          muscleGroup: mg.muscle_group,
          split: mg.split,
        }));

        const result = ExerciseMuscleGroupsAggregate.create(
          exerciseObject,
          muscleGroupSplits,
        );

        if (result.isOk()) {
          results.push(result.value);
        }
      }

      return results;
    });
  },

  getEquipmentPreferences(): ResultAsync<
    ReadonlyArray<{
      muscleGroup: string;
      exerciseType: string;
      preferenceScore: number;
    }>,
    ErrRepository
  > {
    const query = db
      .select()
      .from(equipmentPreferences)
      .where(isNull(equipmentPreferences.deleted_at));

    return executeQuery(query, "getEquipmentPreferences").map((records) =>
      records.map((record) => ({
        muscleGroup: record.muscle_group,
        exerciseType: record.exercise_type,
        preferenceScore: record.preference_score,
      })),
    );
  },
};

function equipmentInstanceRecordToDomain(
  record: InferSelectModel<typeof equipmentInstances>,
): EquipmentInstance {
  return {
    id: record.id,
    exerciseType: record.exercise_type,
    gymFloorId: record.gym_floor_id,
    name: record.name,
    capacity: record.capacity,
    isAvailable: record.is_available,
  };
}
