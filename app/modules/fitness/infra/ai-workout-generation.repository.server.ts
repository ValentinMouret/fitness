import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { err, ok, Result, ResultAsync } from "neverthrow";
import { z } from "zod";
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
import { ConversationMessageSchema } from "../domain/ai-generation";

const trainingPreferenceSourceSchema = z.enum(["refinement", "manual"]);
const conversationDataSchema = z.object({
  messages: z.array(ConversationMessageSchema),
  contextSnapshot: z.record(z.string(), z.unknown()),
});

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

    return ResultAsync.fromPromise(
      db.execute<RecentWorkoutRow>(query),
      (error) => {
        logger.error(
          { err: error },
          "Error fetching recent workouts for AI context",
        );
        return "database_error" as const;
      },
    ).map((result) => result.rows);
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

    return ResultAsync.fromPromise(
      db.execute<ProgressionRow>(query),
      (error) => {
        logger.error({ err: error }, "Error fetching exercise progressions");
        return "database_error" as const;
      },
    ).map((result) => result.rows);
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

    return executeQuery(query, "getTrainingPreferences").andThen((records) =>
      Result.combine(
        records.map((record) => {
          const source = trainingPreferenceSourceSchema.safeParse(
            record.source,
          );
          return source.success
            ? ok({
                id: record.id,
                content: record.content,
                source: source.data,
                createdAt: record.created_at,
              })
            : err("validation_error" as const);
        }),
      ),
    );
  },

  savePreference(
    content: string,
    source: "refinement" | "manual" = "refinement",
  ): ResultAsync<TrainingPreference, ErrRepository> {
    return executeQuery(
      db.insert(trainingPreferences).values({ content, source }).returning(),
      "saveTrainingPreference",
    ).andThen((records) => {
      const record = records[0];
      const parsedSource = trainingPreferenceSourceSchema.safeParse(
        record?.source,
      );

      if (!record || !parsedSource.success) return err("validation_error");

      return ok({
        id: record.id,
        content: record.content,
        source: parsedSource.data,
        createdAt: record.created_at,
      });
    });
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
    ).andThen((records) =>
      records[0] ? conversationToDomain(records[0]) : err("database_error"),
    );
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
    ).andThen((records) =>
      records[0]
        ? conversationToDomain(records[0]).map<GenerationConversation | null>(
            (conversation) => conversation,
          )
        : ok(null),
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
          messages: messages,
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
): Result<GenerationConversation, ErrRepository> {
  const conversationData = conversationDataSchema.safeParse({
    messages: record.messages,
    contextSnapshot: record.context_snapshot,
  });

  if (!conversationData.success) {
    logger.error(
      { err: conversationData.error, conversationId: record.id },
      "Generation conversation contains invalid data",
    );
    return err("validation_error");
  }

  return ok({
    id: record.id,
    workoutId: record.workout_id ?? undefined,
    messages: conversationData.data.messages,
    contextSnapshot: conversationData.data.contextSnapshot,
    model: record.model,
    totalTokens: record.total_tokens,
    createdAt: record.created_at,
  });
}

// Raw row types from SQL queries
export type RecentWorkoutRow = {
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
};

export type ExerciseCatalogRow = {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly movementPattern: string;
  readonly muscleGroup: string;
  readonly split: number;
};

export type ProgressionRow = {
  readonly exercise_name: string;
  readonly workout_date: Date;
  readonly best_weight: number;
  readonly best_reps: number;
  readonly avg_rpe: number | null;
  readonly estimated_one_rep_max: number;
};
