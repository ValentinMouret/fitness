import Anthropic from "@anthropic-ai/sdk";
import { ResultAsync } from "neverthrow";
import { z } from "zod";
import { env } from "~/env.server";
import { logger } from "~/logger.server";
import type { ErrRepository } from "~/repository";
import type {
  ConversationMessage,
  ExerciseCatalogEntry,
  ExerciseProgression,
  GeneratedWorkout,
  GenerationContext,
  MuscleGroupVolumeStats,
  WorkoutSummary,
} from "../domain/ai-generation";
import {
  AIWorkoutGenerationRepository,
  type ProgressionRow,
  type RecentWorkoutRow,
} from "../infra/ai-workout-generation.repository.server";
import { VolumeTrackingService } from "./volume-tracking-service.server";

let anthropic: Anthropic | null = null;
function getClient(): Anthropic {
  if (!anthropic) {
    anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  }
  return anthropic;
}

const generatedWorkoutSchema = z.object({
  name: z.string(),
  rationale: z.string(),
  estimatedDuration: z.number(),
  exercises: z.array(
    z.object({
      exerciseId: z.string(),
      exerciseName: z.string(),
      sets: z.array(
        z.object({
          setNumber: z.number(),
          targetReps: z.number(),
          targetWeight: z.number(),
          isWarmup: z.boolean(),
          restSeconds: z.number(),
        }),
      ),
      notes: z.string().optional(),
    }),
  ),
  sessionNotes: z.string().optional(),
});

type ErrGeneration =
  | "context_assembly_failed"
  | "ai_generation_failed"
  | "invalid_ai_response";

export const AIWorkoutGenerationService = {
  /** Assemble the full training context from the database. */
  assembleContext(
    timeConstraintMinutes?: number,
  ): ResultAsync<GenerationContext, ErrRepository | "context_assembly_failed"> {
    return ResultAsync.combine([
      AIWorkoutGenerationRepository.getRecentWorkouts(4),
      AIWorkoutGenerationRepository.getExerciseCatalog(),
      AIWorkoutGenerationRepository.getExerciseProgressions(4),
      AIWorkoutGenerationRepository.getPreferences(),
      VolumeTrackingService.getCurrentWeekVolume(),
    ])
      .mapErr(() => "context_assembly_failed" as const)
      .map(
        ([
          recentRows,
          catalogRows,
          progressionRows,
          preferences,
          weeklyVolume,
        ]) => {
          const recentWorkouts = groupRecentWorkouts(recentRows);
          const availableExercises = groupExerciseCatalog(catalogRows);
          const exerciseProgressions = groupProgressions(progressionRows);

          const volumeStats: MuscleGroupVolumeStats[] =
            weeklyVolume.targets.map((target) => ({
              muscleGroup: target.muscleGroup,
              currentWeekSets:
                weeklyVolume.currentVolume.get(target.muscleGroup) ?? 0,
              targetMinSets: target.minSets,
              targetMaxSets: target.maxSets,
              remainingSets:
                weeklyVolume.remainingVolume.get(target.muscleGroup) ?? 0,
            }));

          return {
            recentWorkouts,
            volumeStats,
            exerciseProgressions,
            availableExercises,
            preferences: preferences.map((p) => p.content),
            timeConstraintMinutes,
          } satisfies GenerationContext;
        },
      );
  },

  /** Generate a workout using the Claude API. Returns the workout and conversation ID. */
  generateWorkout(
    context: GenerationContext,
  ): ResultAsync<
    { workout: GeneratedWorkout; conversationId: string; tokensUsed: number },
    ErrGeneration | ErrRepository
  > {
    const model = env.ANTHROPIC_MODEL;

    return AIWorkoutGenerationRepository.createConversation(
      context as unknown as Record<string, unknown>,
      model,
    )
      .mapErr(() => "context_assembly_failed" as const)
      .andThen((conversation) => {
        const systemPrompt = buildSystemPrompt(context);
        const userMessage = "Generate my next workout.";

        return ResultAsync.fromPromise(
          callClaude(
            systemPrompt,
            [{ role: "user", content: userMessage }],
            model,
          ),
          (error) => {
            logger.error({ err: error }, "AI workout generation failed");
            return "ai_generation_failed" as const;
          },
        ).andThen(({ workout, assistantMessage, tokensUsed }) => {
          const messages: ConversationMessage[] = [
            { role: "user", content: userMessage },
            { role: "assistant", content: assistantMessage },
          ];

          return AIWorkoutGenerationRepository.updateConversation(
            conversation.id,
            messages,
            tokensUsed,
          )
            .mapErr(() => "context_assembly_failed" as const)
            .map(() => ({
              workout,
              conversationId: conversation.id,
              tokensUsed,
            }));
        });
      });
  },

  /** Refine a generated workout based on user feedback. */
  refineWorkout(
    conversationId: string,
    feedback: string,
  ): ResultAsync<
    { workout: GeneratedWorkout; tokensUsed: number },
    ErrGeneration | ErrRepository
  > {
    return AIWorkoutGenerationRepository.getConversation(conversationId)
      .mapErr(() => "context_assembly_failed" as const)
      .andThen((conversation) => {
        if (!conversation) {
          return ResultAsync.fromPromise(
            Promise.reject("conversation not found"),
            () => "ai_generation_failed" as const,
          );
        }

        const context =
          conversation.contextSnapshot as unknown as GenerationContext;
        const systemPrompt = buildSystemPrompt(context);

        const updatedMessages: ConversationMessage[] = [
          ...conversation.messages,
          { role: "user", content: feedback },
        ];

        const apiMessages = updatedMessages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));

        return ResultAsync.fromPromise(
          callClaude(systemPrompt, apiMessages, conversation.model),
          (error) => {
            logger.error({ err: error }, "AI workout refinement failed");
            return "ai_generation_failed" as const;
          },
        ).andThen(({ workout, assistantMessage, tokensUsed }) => {
          const finalMessages: ConversationMessage[] = [
            ...updatedMessages,
            { role: "assistant", content: assistantMessage },
          ];

          const totalTokens = conversation.totalTokens + tokensUsed;

          return AIWorkoutGenerationRepository.updateConversation(
            conversationId,
            finalMessages,
            totalTokens,
          )
            .mapErr(() => "context_assembly_failed" as const)
            .map(() => ({ workout, tokensUsed }));
        });
      });
  },
};

async function callClaude(
  systemPrompt: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  model: string,
): Promise<{
  workout: GeneratedWorkout;
  assistantMessage: string;
  tokensUsed: number;
}> {
  const client = getClient();

  const response = await client.messages.create({
    model,
    max_tokens: 4000,
    system: systemPrompt,
    messages,
    tools: [
      {
        name: "generate_workout",
        description:
          "Generate a complete workout plan with exercises, sets, reps, and weights",
        input_schema: {
          type: "object" as const,
          properties: {
            name: {
              type: "string",
              description: "Workout name (e.g., 'Push Day - Chest Focus')",
            },
            rationale: {
              type: "string",
              description:
                "Brief explanation of why this workout was chosen (muscle group needs, recovery status, periodization)",
            },
            estimatedDuration: {
              type: "number",
              description: "Estimated workout duration in minutes",
            },
            exercises: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  exerciseId: {
                    type: "string",
                    description: "UUID of the exercise from the catalog",
                  },
                  exerciseName: {
                    type: "string",
                    description: "Name of the exercise",
                  },
                  sets: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        setNumber: { type: "number" },
                        targetReps: { type: "number" },
                        targetWeight: {
                          type: "number",
                          description: "Weight in kg",
                        },
                        isWarmup: { type: "boolean" },
                        restSeconds: {
                          type: "number",
                          description: "Rest period after this set in seconds",
                        },
                      },
                      required: [
                        "setNumber",
                        "targetReps",
                        "targetWeight",
                        "isWarmup",
                        "restSeconds",
                      ],
                    },
                  },
                  notes: {
                    type: "string",
                    description:
                      "Optional notes for this exercise (technique cues, special instructions)",
                  },
                },
                required: ["exerciseId", "exerciseName", "sets"],
              },
            },
            sessionNotes: {
              type: "string",
              description: "Optional overall session notes",
            },
          },
          required: ["name", "rationale", "estimatedDuration", "exercises"],
        },
      },
    ],
    tool_choice: { type: "tool" as const, name: "generate_workout" },
  });

  const toolUse = response.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("AI did not return a workout via tool use");
  }

  const parsed = generatedWorkoutSchema.safeParse(toolUse.input);
  if (!parsed.success) {
    logger.error({ err: parsed.error }, "Invalid AI workout response");
    throw new Error(`Invalid AI response: ${parsed.error.message}`);
  }

  const assistantMessage = response.content
    .filter((c) => c.type === "text")
    .map((c) => (c as { type: "text"; text: string }).text)
    .join(" ");

  const tokensUsed = response.usage.input_tokens + response.usage.output_tokens;

  return { workout: parsed.data, assistantMessage, tokensUsed };
}

function buildSystemPrompt(context: GenerationContext): string {
  const timeConstraint = context.timeConstraintMinutes
    ? `\n**Time constraint**: ${context.timeConstraintMinutes} minutes. Size the workout accordingly.`
    : "";

  const preferences =
    context.preferences.length > 0
      ? `\n## User Preferences\n${context.preferences.map((p) => `- ${p}`).join("\n")}`
      : "";

  return `You are an expert hypertrophy coach generating a workout for a single dedicated trainee. Use evidence-based training science to create an optimal session.

## Training Principles
- **Goal**: Hypertrophy (muscle growth)
- **Progressive overload**: Increase volume (sets × reps) before load. Suggest ~5% weight increase only when the trainee consistently hits the top of rep ranges at RPE 7-8.
- **Rep ranges**: 6-15 reps for compounds, 10-20 for isolation
- **RPE targets**: Working sets at RPE 7-9 (1-3 reps in reserve). If recent RPE has been consistently 9-10, suggest lighter loads or a deload.
- **Volume**: Respect the weekly volume targets below. Prioritize muscle groups with remaining volume debt.
- **Recovery**: Consider days since each muscle group was last trained. Minimum 48h between training the same muscle group.
- **Periodization**: If you see signs of accumulated fatigue (rising RPE at flat or declining performance across 3+ weeks), suggest a deload session (reduce volume by 40-50%, maintain intensity).
- **Exercise selection**: Use exercises from the catalog below. Pick by ID. Balance compound and isolation movements. Alternate exercises occasionally for variety but keep main lifts consistent.
- **Warm-up sets**: Include 1-2 warm-up sets for the first compound exercise (lighter weight, not counted toward volume).
- **Rest periods**: 2-3 min for heavy compounds, 1-2 min for isolation.
${timeConstraint}

## Weekly Volume Status (sets this week / target)
${context.volumeStats.map((v) => `- **${v.muscleGroup}**: ${v.currentWeekSets}/${v.targetMinSets}-${v.targetMaxSets} sets (${v.remainingSets} remaining)`).join("\n")}

## Recent Training History (last 4 weeks)
${formatRecentWorkouts(context.recentWorkouts)}

## Exercise Progressions (e1RM trends)
${formatProgressions(context.exerciseProgressions)}

## Available Exercise Catalog
${formatExerciseCatalog(context.availableExercises)}
${preferences}

## Instructions
1. Decide which muscle groups to train based on recovery status and volume debt.
2. Select exercises from the catalog (use exact exercise IDs).
3. Set appropriate weights based on recent performance, applying progressive overload.
4. Include warm-up sets for the first compound.
5. Provide a brief rationale explaining your choices.
6. If refinement feedback is given, adjust the workout accordingly and explain changes.`;
}

function formatRecentWorkouts(workouts: ReadonlyArray<WorkoutSummary>): string {
  if (workouts.length === 0) return "No recent workouts found.";

  return workouts
    .map((w) => {
      const duration = w.durationMinutes ? ` (${w.durationMinutes} min)` : "";
      const exerciseLines = w.exercises
        .map((e) => {
          const setDetails = e.sets
            .filter((s) => !s.isWarmup)
            .map((s) => {
              const rpe = s.rpe ? ` @RPE${s.rpe}` : "";
              return `${s.reps ?? "?"}×${s.weight ?? "?"}kg${rpe}`;
            })
            .join(", ");
          return `  - ${e.name} [${e.muscleGroups.join(", ")}]: ${setDetails}`;
        })
        .join("\n");
      return `### ${w.date} - ${w.name}${duration}\n${exerciseLines}`;
    })
    .join("\n\n");
}

function formatProgressions(
  progressions: ReadonlyArray<ExerciseProgression>,
): string {
  if (progressions.length === 0) return "No progression data available.";

  return progressions
    .map((p) => {
      const latest = p.recentSessions[p.recentSessions.length - 1];
      if (!latest) return `- **${p.exerciseName}**: no data`;
      const rpe = latest.avgRpe ? ` @RPE${latest.avgRpe.toFixed(1)}` : "";
      return `- **${p.exerciseName}**: e1RM ${latest.estimatedOneRepMax.toFixed(1)}kg (trend: ${p.trend})${rpe}`;
    })
    .join("\n");
}

function formatExerciseCatalog(
  exercises: ReadonlyArray<ExerciseCatalogEntry>,
): string {
  return exercises
    .map((e) => {
      const muscles = e.muscleGroups
        .map((m) => `${m.name}:${m.split}%`)
        .join(", ");
      return `- [${e.id}] ${e.name} (${e.type}, ${e.movementPattern}) → ${muscles}`;
    })
    .join("\n");
}

// --- Context assembly helpers ---

function groupRecentWorkouts(
  rows: ReadonlyArray<RecentWorkoutRow>,
): WorkoutSummary[] {
  const workoutMap = new Map<
    string,
    {
      name: string;
      date: Date;
      stop: Date | null;
      exercises: Map<
        string,
        {
          name: string;
          muscleGroups: string[];
          sets: Array<{
            reps?: number;
            weight?: number;
            rpe?: number;
            isWarmup: boolean;
          }>;
        }
      >;
    }
  >();

  for (const row of rows) {
    let workout = workoutMap.get(row.workout_id);
    if (!workout) {
      workout = {
        name: row.workout_name,
        date:
          row.workout_start instanceof Date
            ? row.workout_start
            : new Date(row.workout_start),
        stop: row.workout_stop
          ? row.workout_stop instanceof Date
            ? row.workout_stop
            : new Date(row.workout_stop)
          : null,
        exercises: new Map(),
      };
      workoutMap.set(row.workout_id, workout);
    }

    let exercise = workout.exercises.get(row.exercise_id);
    if (!exercise) {
      exercise = {
        name: row.exercise_name,
        muscleGroups: [],
        sets: [],
      };
      workout.exercises.set(row.exercise_id, exercise);
    }

    if (row.is_completed) {
      exercise.sets.push({
        reps: row.reps ?? undefined,
        weight: row.weight ? Number(row.weight) : undefined,
        rpe: row.rpe ? Number(row.rpe) : undefined,
        isWarmup: row.is_warmup,
      });
    }
  }

  return Array.from(workoutMap.values()).map((w) => {
    const durationMinutes =
      w.stop && w.date
        ? Math.round((w.stop.getTime() - w.date.getTime()) / 60000)
        : undefined;

    return {
      date: w.date.toISOString().split("T")[0],
      name: w.name,
      durationMinutes,
      exercises: Array.from(w.exercises.values()),
    };
  });
}

function groupExerciseCatalog(
  rows: ReadonlyArray<{
    id: string;
    name: string;
    type: string;
    movementPattern: string;
    muscleGroup: string;
    split: number;
  }>,
): ExerciseCatalogEntry[] {
  const exerciseMap = new Map<
    string,
    {
      id: string;
      name: string;
      type: string;
      movementPattern: string;
      muscleGroups: Array<{ name: string; split: number }>;
    }
  >();

  for (const row of rows) {
    let entry = exerciseMap.get(row.id);
    if (!entry) {
      entry = {
        id: row.id,
        name: row.name,
        type: row.type,
        movementPattern: row.movementPattern,
        muscleGroups: [],
      };
      exerciseMap.set(row.id, entry);
    }
    entry.muscleGroups.push({ name: row.muscleGroup, split: row.split });
  }

  return Array.from(exerciseMap.values());
}

function groupProgressions(
  rows: ReadonlyArray<ProgressionRow>,
): ExerciseProgression[] {
  const exerciseMap = new Map<
    string,
    Array<{
      date: string;
      bestWeight: number;
      bestReps: number;
      avgRpe?: number;
      estimatedOneRepMax: number;
    }>
  >();

  for (const row of rows) {
    const sessions = exerciseMap.get(row.exercise_name) ?? [];
    sessions.push({
      date:
        row.workout_date instanceof Date
          ? row.workout_date.toISOString().split("T")[0]
          : new Date(row.workout_date).toISOString().split("T")[0],
      bestWeight: Number(row.best_weight),
      bestReps: Number(row.best_reps),
      avgRpe: row.avg_rpe ? Number(row.avg_rpe) : undefined,
      estimatedOneRepMax: Number(row.estimated_one_rep_max),
    });
    exerciseMap.set(row.exercise_name, sessions);
  }

  return Array.from(exerciseMap.entries())
    .filter(([_, sessions]) => sessions.length >= 2)
    .map(([exerciseName, sessions]) => {
      const sorted = sessions.sort((a, b) => a.date.localeCompare(b.date));
      const firstHalf = sorted.slice(0, Math.floor(sorted.length / 2));
      const secondHalf = sorted.slice(-Math.floor(sorted.length / 2));

      const firstAvg =
        firstHalf.reduce((s, x) => s + x.estimatedOneRepMax, 0) /
        firstHalf.length;
      const secondAvg =
        secondHalf.reduce((s, x) => s + x.estimatedOneRepMax, 0) /
        secondHalf.length;

      const pctChange = ((secondAvg - firstAvg) / firstAvg) * 100;
      const trend: "improving" | "stable" | "declining" =
        pctChange > 5 ? "improving" : pctChange < -5 ? "declining" : "stable";

      return {
        exerciseName,
        recentSessions: sorted,
        trend,
      };
    });
}
