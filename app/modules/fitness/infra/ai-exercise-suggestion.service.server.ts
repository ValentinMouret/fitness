import { okAsync, ResultAsync } from "neverthrow";
import { z } from "zod";
import { env } from "~/env.server";
import { logger } from "~/logger.server";
import type { ErrRepository } from "~/repository";
import type {
  GenerationContext,
  SuggestedExercise,
} from "../domain/ai-generation";
import type { WorkoutSession } from "../domain/workout";
import { getAiClient } from "./ai-client.server";
import {
  formatExerciseCatalog,
  formatProgressions,
  formatRecentWorkouts,
} from "./ai-context-formatters.server";
import { AIWorkoutGenerationService } from "./ai-workout-generation.service.server";
import { WorkoutSessionRepository } from "./workout.repository.server";

type ErrSuggestion =
  | "context_assembly_failed"
  | "workout_not_found"
  | "ai_suggestion_failed"
  | "invalid_ai_response";

const suggestedExercisesSchema = z.object({
  suggestions: z
    .array(
      z.object({
        exerciseId: z.string(),
        exerciseName: z.string(),
        exerciseType: z.string(),
        rationale: z.string(),
        muscleGroups: z.array(z.string()),
      }),
    )
    .length(3),
});

export const AIExerciseSuggestionService = {
  suggestExercises(
    workoutId: string,
    excludedExerciseIds: ReadonlyArray<string>,
  ): ResultAsync<
    ReadonlyArray<SuggestedExercise>,
    ErrSuggestion | ErrRepository
  > {
    return WorkoutSessionRepository.findById(workoutId)
      .mapErr((): ErrSuggestion => "context_assembly_failed")
      .andThen((session) => {
        if (!session) {
          return ResultAsync.fromSafePromise(
            Promise.reject<never>("workout_not_found"),
          ).mapErr((): ErrSuggestion => "workout_not_found");
        }
        return okAsync(session);
      })
      .andThen((session) =>
        AIWorkoutGenerationService.assembleContext()
          .mapErr((): ErrSuggestion => "context_assembly_failed")
          .andThen((context) =>
            ResultAsync.fromPromise(
              callClaudeSuggest(session, context, excludedExerciseIds),
              (error) => {
                logger.error({ err: error }, "AI exercise suggestion failed");
                return "ai_suggestion_failed" as ErrSuggestion;
              },
            ),
          ),
      );
  },
};

async function callClaudeSuggest(
  session: WorkoutSession,
  context: GenerationContext,
  excludedExerciseIds: ReadonlyArray<string>,
): Promise<ReadonlyArray<SuggestedExercise>> {
  const client = getAiClient();
  const model = env.ANTHROPIC_MODEL;

  const systemPrompt = buildSuggestionPrompt(
    session,
    context,
    excludedExerciseIds,
  );

  const response = await client.messages.create({
    model,
    max_tokens: 1000,
    system: systemPrompt,
    messages: [{ role: "user", content: "Suggest exercises for my workout." }],
    tools: [
      {
        name: "suggest_exercises",
        description:
          "Suggest exactly 3 exercises to add to the current workout session",
        input_schema: {
          type: "object" as const,
          properties: {
            suggestions: {
              type: "array",
              description: "Exactly 3 exercise suggestions",
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
                  exerciseType: {
                    type: "string",
                    description:
                      "Equipment type (barbell, dumbbells, cable, machine, bodyweight)",
                  },
                  rationale: {
                    type: "string",
                    description:
                      "1-2 sentences explaining why this exercise complements the current workout",
                  },
                  muscleGroups: {
                    type: "array",
                    items: { type: "string" },
                    description: "Primary muscle groups targeted",
                  },
                },
                required: [
                  "exerciseId",
                  "exerciseName",
                  "exerciseType",
                  "rationale",
                  "muscleGroups",
                ],
              },
              minItems: 3,
              maxItems: 3,
            },
          },
          required: ["suggestions"],
        },
      },
    ],
    tool_choice: { type: "any" },
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("No tool use in AI response");
  }

  const parsed = suggestedExercisesSchema.safeParse(toolUse.input);
  if (!parsed.success) {
    logger.error({ error: parsed.error }, "Invalid AI suggestion response");
    throw new Error("invalid_ai_response");
  }

  return parsed.data.suggestions;
}

function buildSuggestionPrompt(
  session: WorkoutSession,
  context: GenerationContext,
  excludedExerciseIds: ReadonlyArray<string>,
): string {
  const today = new Date().toISOString().split("T")[0];

  const currentExercises =
    session.exerciseGroups.length > 0
      ? session.exerciseGroups
          .map((g) => `- ${g.exercise.name} (${g.exercise.type})`)
          .join("\n")
      : "No exercises added yet.";

  const currentExerciseIds = session.exerciseGroups.map((g) => g.exercise.id);

  const exclusionSection =
    excludedExerciseIds.length > 0
      ? `\n## Do NOT suggest these exercise IDs (already shown or in workout)\n${[...currentExerciseIds, ...excludedExerciseIds].join("\n")}`
      : currentExerciseIds.length > 0
        ? `\n## Do NOT suggest these exercise IDs (already in workout)\n${currentExerciseIds.join("\n")}`
        : "";

  return `You are an expert strength coach helping a trainee add exercises mid-session. Today is ${today}.

## Current Workout: "${session.workout.name}"
Exercises already in this session:
${currentExercises}

## Your Task
Suggest exactly 3 exercises that complement this workout. Consider:
1. Fill muscle group gaps or add volume to undertrained groups
2. Respect 48h recovery (check recent training history)
3. Prioritize muscles with remaining weekly volume debt
4. Vary movement patterns for balance
5. ONLY use exercises from the catalog below by exact IDs
6. Do NOT suggest exercises already in the workout or the exclusion list
${exclusionSection}

## Weekly Volume Status (sets this week / target)
${context.volumeStats.map((v) => `- **${v.muscleGroup}**: ${v.currentWeekSets}/${v.targetMinSets}-${v.targetMaxSets} sets (${v.remainingSets} remaining)`).join("\n")}

## Recent Training History (last 4 weeks)
${formatRecentWorkouts(context.recentWorkouts)}

## Exercise Progressions (e1RM trends)
${formatProgressions(context.exerciseProgressions)}

## Available Exercise Catalog
${formatExerciseCatalog(context.availableExercises)}

Call the suggest_exercises tool with your 3 choices.`;
}
