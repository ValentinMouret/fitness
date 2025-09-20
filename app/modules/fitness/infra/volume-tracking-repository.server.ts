import type { ResultAsync } from "neverthrow";
import { db } from "~/db";
import type { ErrRepository } from "~/repository";
import { executeQuery } from "~/repository.server";
import type { MuscleGroup } from "~/modules/fitness/domain/workout";
import {
  workouts,
  workoutExercises,
  workoutSets,
  exercises,
  exerciseMuscleGroups,
} from "~/db/schema";
import { eq, and, gte, lte, isNull, sql } from "drizzle-orm";

export const VolumeTrackingRepository = {
  getWeeklyVolume(
    weekStart: Date,
  ): ResultAsync<ReadonlyMap<MuscleGroup, number>, ErrRepository> {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const query = db
      .select({
        muscle_group: exerciseMuscleGroups.muscle_group,
        split: exerciseMuscleGroups.split,
        set_count: sql<number>`count(${workoutSets.set})`,
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
        ),
      )
      .where(
        and(
          gte(workouts.start, weekStart),
          lte(workouts.start, weekEnd),
          isNull(workouts.deleted_at),
          isNull(workoutExercises.deleted_at),
          isNull(exercises.deleted_at),
          isNull(exerciseMuscleGroups.deleted_at),
        ),
      )
      .groupBy(exerciseMuscleGroups.muscle_group, exerciseMuscleGroups.split);

    return executeQuery(query, "getWeeklyVolume").map((records) => {
      const volumeMap = new Map<MuscleGroup, number>();

      for (const record of records) {
        const muscleGroup = record.muscle_group as MuscleGroup;
        const weightedSets = (record.set_count * record.split) / 100;
        const currentVolume = volumeMap.get(muscleGroup) ?? 0;
        volumeMap.set(muscleGroup, currentVolume + weightedSets);
      }

      return volumeMap;
    });
  },

  recordWorkoutVolume(
    workoutId: string,
    _muscleGroupVolumes: ReadonlyMap<MuscleGroup, number>,
    _weekStart: Date,
  ): ResultAsync<void, ErrRepository> {
    // In a real implementation, this might store workout volume summaries
    // For now, we'll just validate that the workout exists and return success
    const query = db
      .select({ id: workouts.id })
      .from(workouts)
      .where(eq(workouts.id, workoutId))
      .limit(1);

    return executeQuery(query, "recordWorkoutVolume").map((records) => {
      if (records.length === 0) {
        throw new Error(`Workout not found: ${workoutId}`);
      }
      // In a production system, you might want to store volume tracking records
      // For now, we'll rely on calculating from workout_sets
      return undefined;
    });
  },

  getHistoricalVolume(
    muscleGroup: MuscleGroup,
    startDate: Date,
    endDate: Date,
  ): ResultAsync<ReadonlyArray<{ date: Date; volume: number }>, ErrRepository> {
    const query = db
      .select({
        workout_date: workouts.start,
        set_count: sql<number>`count(${workoutSets.set})`,
        split: exerciseMuscleGroups.split,
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
        ),
      )
      .where(
        and(
          eq(exerciseMuscleGroups.muscle_group, muscleGroup),
          gte(workouts.start, startDate),
          lte(workouts.start, endDate),
          isNull(workouts.deleted_at),
          isNull(workoutExercises.deleted_at),
          isNull(exercises.deleted_at),
          isNull(exerciseMuscleGroups.deleted_at),
        ),
      )
      .groupBy(workouts.start, exerciseMuscleGroups.split)
      .orderBy(workouts.start);

    return executeQuery(query, "getHistoricalVolume").map((records) => {
      const volumeByDate = new Map<string, number>();

      for (const record of records) {
        const dateKey = record.workout_date?.toISOString().split("T")[0];
        if (!dateKey || !record.workout_date) continue;

        const weightedSets = (record.set_count * record.split) / 100;
        const currentVolume = volumeByDate.get(dateKey) ?? 0;
        volumeByDate.set(dateKey, currentVolume + weightedSets);
      }

      return Array.from(volumeByDate.entries()).map(([dateStr, volume]) => ({
        date: new Date(dateStr),
        volume,
      }));
    });
  },
};
