import { eq, sql } from "drizzle-orm";
import type { ResultAsync } from "neverthrow";
import { db } from "~/db";
import { workouts } from "~/db/schema";
import type { MuscleGroup } from "~/modules/fitness/domain/workout";
import type { ErrRepository } from "~/repository";
import { executeQuery } from "~/repository.server";

export const VolumeTrackingRepository = {
  getWeeklyVolume(
    weekStart: Date,
  ): ResultAsync<ReadonlyMap<MuscleGroup, number>, ErrRepository> {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const query = sql`
      select muscle_group, sum(weighted_sets) as volume
        from fitness_data.muscle_volume
       where start >= ${weekStart.toISOString()}::timestamptz
         and start < ${weekEnd.toISOString()}::timestamptz
       group by muscle_group
    `;
    return executeQuery(
      db.execute<{ muscle_group: MuscleGroup; volume: string }>(query),
      "getWeeklyVolume",
    ).map(
      (result) =>
        new Map(
          result.rows.map((row) => [row.muscle_group, Number(row.volume)]),
        ),
    );
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
    const query = sql`
      select (start at time zone 'UTC')::date::text as date, sum(weighted_sets) as volume
        from fitness_data.muscle_volume
       where muscle_group = ${muscleGroup}
         and start >= ${startDate.toISOString()}::timestamptz
         and start < ${endDate.toISOString()}::timestamptz
       group by 1 order by 1
    `;
    return executeQuery(
      db.execute<{ date: string; volume: string }>(query),
      "getHistoricalVolume",
    ).map((result) =>
      result.rows.map((row) => ({
        date: new Date(`${row.date}T00:00:00Z`),
        volume: Number(row.volume),
      })),
    );
  },
};
