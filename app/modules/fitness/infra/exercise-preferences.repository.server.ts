import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "~/db";
import {
  exercisePreferences,
  exercises,
  workoutExercises,
  workouts,
} from "~/db/schema";
import type { UserId } from "~/modules/auth/domain/user";
import type { Exercise } from "../domain/workout";

export async function projectExercisePreferences(
  userId: UserId,
  entries: readonly Exercise[],
  database: Pick<typeof db, "select"> = db,
): Promise<readonly Exercise[]> {
  if (!entries.length) return [];
  const preferences = await database
    .select()
    .from(exercisePreferences)
    .where(
      and(
        eq(exercisePreferences.userId, userId),
        inArray(
          exercisePreferences.exerciseId,
          entries.map((entry) => entry.id),
        ),
        isNull(exercisePreferences.deleted_at),
      ),
    );
  const byId = new Map(
    preferences.map((preference) => [preference.exerciseId, preference]),
  );
  return entries.map((entry) => ({
    ...entry,
    description: byId.get(entry.id)?.description ?? undefined,
    mmcInstructions: byId.get(entry.id)?.mmcInstructions ?? undefined,
  }));
}

export async function updateWorkoutExerciseCue(
  userId: UserId,
  input: {
    readonly workoutId: string;
    readonly exerciseId: string;
    readonly mmcInstructions?: string;
  },
  database: typeof db = db,
): Promise<boolean> {
  return database.transaction(async (tx) => {
    const [workout] = await tx
      .select({ id: workouts.id })
      .from(workouts)
      .where(
        and(
          eq(workouts.id, input.workoutId),
          eq(workouts.userId, userId),
          isNull(workouts.deleted_at),
        ),
      )
      .for("update");
    if (!workout) return false;
    const [membership] = await tx
      .select({ id: workoutExercises.exercise_id })
      .from(workoutExercises)
      .innerJoin(exercises, eq(workoutExercises.exercise_id, exercises.id))
      .where(
        and(
          eq(workoutExercises.workout_id, workout.id),
          eq(workoutExercises.exercise_id, input.exerciseId),
          isNull(workoutExercises.deleted_at),
          isNull(exercises.deleted_at),
        ),
      )
      .for("share");
    if (!membership) return false;
    await tx
      .insert(exercisePreferences)
      .values({
        userId,
        exerciseId: input.exerciseId,
        mmcInstructions: input.mmcInstructions ?? null,
      })
      .onConflictDoUpdate({
        target: [exercisePreferences.userId, exercisePreferences.exerciseId],
        set: {
          mmcInstructions: input.mmcInstructions ?? null,
          deleted_at: null,
          updated_at: new Date(),
        },
      });
    return true;
  });
}
