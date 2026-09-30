import { and, eq, type SQL, sql } from "drizzle-orm";
import { err, ok, ResultAsync } from "neverthrow";
import { db } from "~/db";
import { workouts } from "~/db/schema";
import type { UserId } from "~/modules/auth/domain/user";
import type { MuscleGroup } from "~/modules/fitness/domain/workout";
import type { ErrRepository } from "~/repository";
import { executeQuery } from "~/repository.server";

export function createVolumeTrackingRepository(userId: UserId, database = db) {
  const read = <T extends Record<string, unknown>>(query: SQL) =>
    ResultAsync.fromPromise(
      database.transaction(
        async (tx) => {
          await tx.execute(
            sql`select set_config('fitness.user_id',${userId},true)`,
          );
          return tx.execute<T>(query);
        },
        { accessMode: "read only" },
      ),
      () => "database_error" as const,
    );
  return {
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
      return read<{ muscle_group: MuscleGroup; volume: string }>(query).map(
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
      const query = database
        .select({ id: workouts.id })
        .from(workouts)
        .where(and(eq(workouts.userId, userId), eq(workouts.id, workoutId)))
        .limit(1);

      return executeQuery(query, "recordWorkoutVolume").andThen((records) =>
        records.length ? ok(undefined) : err("not_found" as const),
      );
    },

    getHistoricalVolume(
      muscleGroup: MuscleGroup,
      startDate: Date,
      endDate: Date,
    ): ResultAsync<
      ReadonlyArray<{ date: Date; volume: number }>,
      ErrRepository
    > {
      const query = sql`
      select (start at time zone 'UTC')::date::text as date, sum(weighted_sets) as volume
        from fitness_data.muscle_volume
       where muscle_group = ${muscleGroup}
         and start >= ${startDate.toISOString()}::timestamptz
         and start < ${endDate.toISOString()}::timestamptz
       group by 1 order by 1
    `;
      return read<{ date: string; volume: string }>(query).map((result) =>
        result.rows.map((row) => ({
          date: new Date(`${row.date}T00:00:00Z`),
          volume: Number(row.volume),
        })),
      );
    },
  };
}
