import { and, eq, gte, isNotNull, isNull } from "drizzle-orm";
import type { ResultAsync } from "neverthrow";
import { db } from "~/db";
import {
  exerciseMuscleGroups,
  exercises,
  workoutExercises,
  workoutSets,
  workouts,
} from "~/db/schema";
import type { MuscleFatigueEvent } from "~/modules/fitness/domain/muscle-recovery";
import type { MuscleGroup } from "~/modules/fitness/domain/workout";
import type { ErrRepository } from "~/repository";
import { executeQuery } from "~/repository.server";

export const MuscleRecoveryRepository = {
  /**
   * Get fatigue events for all muscle groups from the last 7 days.
   * Groups by (muscle_group, workout start time) and calculates
   * volume load as Σ(reps × coalesce(weight, 1) × split / 100).
   */
  getRecentFatigueEvents(): ResultAsync<
    ReadonlyArray<MuscleFatigueEvent>,
    ErrRepository
  > {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const query = db
      .select({
        muscle_group: exerciseMuscleGroups.muscle_group,
        split: exerciseMuscleGroups.split,
        workout_date: workouts.start,
        reps: workoutSets.reps,
        weight: workoutSets.weight,
      })
      .from(workouts)
      .innerJoin(workoutExercises, eq(workouts.id, workoutExercises.workout_id))
      .innerJoin(exercises, eq(workoutExercises.exercise_id, exercises.id))
      .innerJoin(
        exerciseMuscleGroups,
        eq(exercises.id, exerciseMuscleGroups.exercise),
      )
      .innerJoin(
        workoutSets,
        and(
          eq(workoutSets.workout, workouts.id),
          eq(workoutSets.exercise, exercises.id),
          eq(workoutSets.isCompleted, true),
          eq(workoutSets.isWarmup, false),
        ),
      )
      .where(
        and(
          gte(workouts.start, sevenDaysAgo),
          isNotNull(workouts.stop),
          isNull(workouts.deleted_at),
          isNull(workoutExercises.deleted_at),
          isNull(exercises.deleted_at),
          isNull(exerciseMuscleGroups.deleted_at),
        ),
      );

    return executeQuery(query, "getRecentFatigueEvents").map((records) => {
      // Group by (muscle_group, workout_date) and sum volume
      const grouped = new Map<string, MuscleFatigueEvent>();

      for (const record of records) {
        if (!record.workout_date) continue;
        const reps = record.reps ?? 0;
        const weight = record.weight ?? 1;
        const volumeContribution =
          (reps * Math.max(weight, 1) * record.split) / 100;

        const key = `${record.muscle_group}:${record.workout_date.toISOString()}`;
        const existing = grouped.get(key);

        if (existing) {
          grouped.set(key, {
            ...existing,
            volumeLoad: existing.volumeLoad + volumeContribution,
          });
        } else {
          grouped.set(key, {
            muscleGroup: record.muscle_group as MuscleGroup,
            volumeLoad: volumeContribution,
            workoutDate: record.workout_date,
          });
        }
      }

      return Array.from(grouped.values());
    });
  },
};
