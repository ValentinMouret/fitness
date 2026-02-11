import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { ResultAsync } from "neverthrow";
import { db } from "~/db";
import {
  exerciseMuscleGroups,
  exercises,
  generationConversations,
  trainingPreferences,
} from "~/db/schema";
import { logger } from "~/logger.server";
import type { ErrRepository } from "~/repository";
import { executeQuery } from "~/repository.server";
import type {
  ConversationMessage,
  GenerationConversation,
  TrainingPreference,
} from "../domain/ai-generation";

export const AIWorkoutGenerationRepository = {
  /** Fetch recent completed workouts with all sets, grouped by exercise. */
  getRecentWorkouts(
    weeksBack = 4,
  ): ResultAsync<ReadonlyArray<RecentWorkoutRow>, ErrRepository> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - weeksBack * 7);

    const query = sql`
      SELECT
        w.id            AS workout_id,
        w.name          AS workout_name,
        w.start         AS workout_start,
        w.stop          AS workout_stop,
        e.id            AS exercise_id,
        e.name          AS exercise_name,
        e.type          AS exercise_type,
        e.movement_pattern,
        ws.set,
        ws.reps,
        ws.weight,
        ws."isWarmup"   AS is_warmup,
        ws."isCompleted" AS is_completed,
        ws."isFailure"  AS is_failure,
        ws.rpe
      FROM workouts w
      INNER JOIN workout_exercises we ON we.workout_id = w.id AND we.deleted_at IS NULL
      INNER JOIN exercises e ON e.id = we.exercise_id
      INNER JOIN workout_sets ws ON ws.workout = w.id AND ws.exercise = e.id AND ws.deleted_at IS NULL
      WHERE w.stop IS NOT NULL
        AND w.deleted_at IS NULL
        AND w.start >= ${cutoffDate}
      ORDER BY w.start DESC, we.order_index ASC, ws.set ASC
    `;

    return ResultAsync.fromPromise(db.execute(query), (error) => {
      logger.error(
        { err: error },
        "Error fetching recent workouts for AI context",
      );
      return "database_error" as const;
    }).map((result) => result.rows as unknown as RecentWorkoutRow[]);
  },

  /** Fetch all exercises with their muscle group splits for the catalog. */
  getExerciseCatalog(): ResultAsync<
    ReadonlyArray<ExerciseCatalogRow>,
    ErrRepository
  > {
    const query = db
      .select({
        id: exercises.id,
        name: exercises.name,
        type: exercises.type,
        movementPattern: exercises.movement_pattern,
        muscleGroup: exerciseMuscleGroups.muscle_group,
        split: exerciseMuscleGroups.split,
      })
      .from(exercises)
      .innerJoin(
        exerciseMuscleGroups,
        eq(exercises.id, exerciseMuscleGroups.exercise),
      )
      .where(isNull(exercises.deleted_at))
      .orderBy(exercises.name);

    return executeQuery(query, "getExerciseCatalog");
  },

  /** Fetch e1RM progression data for recent exercises. */
  getExerciseProgressions(
    weeksBack = 4,
  ): ResultAsync<ReadonlyArray<ProgressionRow>, ErrRepository> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - weeksBack * 7);

    const query = sql`
      SELECT
        e.name          AS exercise_name,
        w.start         AS workout_date,
        MAX(ws.weight)  AS best_weight,
        MAX(ws.reps)    AS best_reps,
        AVG(ws.rpe)     AS avg_rpe,
        MAX(ws.weight * (1 + ws.reps::float / 30)) AS estimated_one_rep_max
      FROM workout_sets ws
      INNER JOIN workouts w ON ws.workout = w.id
      INNER JOIN exercises e ON ws.exercise = e.id
      WHERE w.stop IS NOT NULL
        AND ws."isCompleted" = true
        AND ws."isWarmup" = false
        AND ws.deleted_at IS NULL
        AND w.deleted_at IS NULL
        AND w.start >= ${cutoffDate}
        AND ws.weight IS NOT NULL
        AND ws.reps IS NOT NULL
      GROUP BY e.name, w.id, w.start
      ORDER BY e.name, w.start ASC
    `;

    return ResultAsync.fromPromise(db.execute(query), (error) => {
      logger.error({ err: error }, "Error fetching exercise progressions");
      return "database_error" as const;
    }).map((result) => result.rows as unknown as ProgressionRow[]);
  },

  // --- Training Preferences ---

  getPreferences(): ResultAsync<
    ReadonlyArray<TrainingPreference>,
    ErrRepository
  > {
    const query = db
      .select()
      .from(trainingPreferences)
      .where(isNull(trainingPreferences.deleted_at))
      .orderBy(desc(trainingPreferences.created_at));

    return executeQuery(query, "getTrainingPreferences").map((records) =>
      records.map((r) => ({
        id: r.id,
        content: r.content,
        source: r.source as "refinement" | "manual",
        createdAt: r.created_at,
      })),
    );
  },

  savePreference(
    content: string,
    source: "refinement" | "manual" = "refinement",
  ): ResultAsync<TrainingPreference, ErrRepository> {
    return executeQuery(
      db.insert(trainingPreferences).values({ content, source }).returning(),
      "saveTrainingPreference",
    ).map((records) => ({
      id: records[0].id,
      content: records[0].content,
      source: records[0].source as "refinement" | "manual",
      createdAt: records[0].created_at,
    }));
  },

  deletePreference(id: string): ResultAsync<void, ErrRepository> {
    return executeQuery(
      db
        .update(trainingPreferences)
        .set({ deleted_at: new Date() })
        .where(eq(trainingPreferences.id, id)),
      "deleteTrainingPreference",
    ).map(() => undefined);
  },

  // --- Generation Conversations ---

  createConversation(
    contextSnapshot: Record<string, unknown>,
    model: string,
  ): ResultAsync<GenerationConversation, ErrRepository> {
    return executeQuery(
      db
        .insert(generationConversations)
        .values({
          messages: [],
          context_snapshot: contextSnapshot,
          model,
        })
        .returning(),
      "createConversation",
    ).map((records) => conversationToDomain(records[0]));
  },

  getConversation(
    id: string,
  ): ResultAsync<GenerationConversation | null, ErrRepository> {
    return executeQuery(
      db
        .select()
        .from(generationConversations)
        .where(
          and(
            eq(generationConversations.id, id),
            isNull(generationConversations.deleted_at),
          ),
        ),
      "getConversation",
    ).map((records) =>
      records.length > 0 ? conversationToDomain(records[0]) : null,
    );
  },

  updateConversation(
    id: string,
    messages: ReadonlyArray<ConversationMessage>,
    totalTokens: number,
  ): ResultAsync<void, ErrRepository> {
    return executeQuery(
      db
        .update(generationConversations)
        .set({
          messages: messages as ConversationMessage[],
          total_tokens: totalTokens,
          updated_at: new Date(),
        })
        .where(eq(generationConversations.id, id)),
      "updateConversation",
    ).map(() => undefined);
  },

  linkConversationToWorkout(
    conversationId: string,
    workoutId: string,
  ): ResultAsync<void, ErrRepository> {
    return executeQuery(
      db
        .update(generationConversations)
        .set({ workout_id: workoutId, updated_at: new Date() })
        .where(eq(generationConversations.id, conversationId)),
      "linkConversationToWorkout",
    ).map(() => undefined);
  },
};

function conversationToDomain(
  record: typeof generationConversations.$inferSelect,
): GenerationConversation {
  return {
    id: record.id,
    workoutId: record.workout_id ?? undefined,
    messages: record.messages as ConversationMessage[],
    contextSnapshot: record.context_snapshot as Record<string, unknown>,
    model: record.model,
    totalTokens: record.total_tokens,
    createdAt: record.created_at,
  };
}

// Raw row types from SQL queries
export interface RecentWorkoutRow {
  readonly workout_id: string;
  readonly workout_name: string;
  readonly workout_start: Date;
  readonly workout_stop: Date | null;
  readonly exercise_id: string;
  readonly exercise_name: string;
  readonly exercise_type: string;
  readonly movement_pattern: string;
  readonly set: number;
  readonly reps: number | null;
  readonly weight: number | null;
  readonly is_warmup: boolean;
  readonly is_completed: boolean;
  readonly is_failure: boolean;
  readonly rpe: number | null;
}

export type ExerciseCatalogRow = {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly movementPattern: string;
  readonly muscleGroup: string;
  readonly split: number;
};

export interface ProgressionRow {
  readonly exercise_name: string;
  readonly workout_date: Date;
  readonly best_weight: number;
  readonly best_reps: number;
  readonly avg_rpe: number | null;
  readonly estimated_one_rep_max: number;
}
