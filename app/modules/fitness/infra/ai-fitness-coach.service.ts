import Anthropic from "@anthropic-ai/sdk";
import { err, ok, type Result } from "neverthrow";
import { z } from "zod";
import { env } from "~/env.server";
import { logger } from "~/logger.server";

const AIFitnessAnalysisSchema = z.object({
  progressionAnalysis: z.object({
    overallTrend: z.enum(["improving", "plateauing", "declining"]),
    strengthGains: z.string(),
    volumeProgression: z.string(),
    consistencyScore: z.number().min(0).max(10),
  }),
  observations: z.object({
    muscleGroupBalance: z.string(),
    exerciseVariety: z.string(),
    workoutFrequency: z.string(),
    recoveryPatterns: z.string(),
  }),
  suggestions: z.object({
    immediateActions: z.array(z.string()),
    programAdjustments: z.array(z.string()),
    exerciseRecommendations: z.array(z.string()),
  }),
  thingsToTry: z.object({
    newExercises: z.array(z.string()),
    trainingTechniques: z.array(z.string()),
    periodizationChanges: z.array(z.string()),
  }),
});

type AIFitnessAnalysis = z.infer<typeof AIFitnessAnalysisSchema>;

export interface WorkoutAnalysisData {
  timeframe: {
    startDate: Date;
    endDate: Date;
    totalWorkouts: number;
    weeksActive: number;
  };
  progressionMetrics: {
    strengthProgression: Array<{
      exercise: string;
      startingWeight: number;
      currentWeight: number;
      percentIncrease: number;
    }>;
    volumeProgression: Array<{
      muscleGroup: string;
      weeklyAverageVolume: number;
      trend: "increasing" | "stable" | "decreasing";
    }>;
    frequencyTrends: {
      averageWorkoutsPerWeek: number;
      longestStreak: number;
      consistencyScore: number;
    };
  };
  muscleGroupBalance: {
    currentWeekVolume: Array<{
      muscleGroup: string;
      completedVolume: number;
      targetVolume: number;
      percentageComplete: number;
    }>;
    overallBalance: Array<{
      muscleGroup: string;
      totalVolume: number;
      percentageOfTotal: number;
    }>;
  };
  exerciseDistribution: {
    movementPatterns: Array<{
      pattern: string;
      frequency: number;
      percentage: number;
    }>;
    equipmentUsage: Array<{
      type: string;
      frequency: number;
      percentage: number;
    }>;
    exerciseVariety: {
      totalUniqueExercises: number;
      averageExercisesPerWorkout: number;
      mostFrequentExercises: Array<{
        name: string;
        frequency: number;
      }>;
    };
  };
  workoutCharacteristics: {
    averageDuration: number;
    averageSetsPerWorkout: number;
    averageRepsPerSet: number;
    failureSetPercentage: number;
    warmupSetPercentage: number;
  };
}

export interface AIFitnessCoachResult {
  analysis: AIFitnessAnalysis;
  rawResponse: string;
  tokensUsed: number;
}

let anthropic: Anthropic | null = null;

function getClient(): Anthropic {
  if (!anthropic) {
    const apiKey = env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY environment variable is required");
    }
    anthropic = new Anthropic({ apiKey });
  }
  return anthropic;
}

export const AIFitnessCoachService = {
  async analyzeWorkouts(
    workoutData: WorkoutAnalysisData,
  ): Promise<Result<AIFitnessCoachResult, Error>> {
    try {
      const client = getClient();

      const prompt = this.buildAnalysisPrompt(workoutData);

      const message = await client.messages.create({
        model: "claude-4-opus-20250514",
        max_tokens: 2000,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        tools: [
          {
            name: "provide_fitness_analysis",
            description:
              "Provide comprehensive fitness analysis and recommendations",
            input_schema: {
              type: "object",
              properties: {
                progressionAnalysis: {
                  type: "object",
                  properties: {
                    overallTrend: {
                      type: "string",
                      enum: ["improving", "plateauing", "declining"],
                      description: "Overall progression trend",
                    },
                    strengthGains: {
                      type: "string",
                      description: "Analysis of strength progression patterns",
                    },
                    volumeProgression: {
                      type: "string",
                      description: "Analysis of training volume changes",
                    },
                    consistencyScore: {
                      type: "number",
                      minimum: 0,
                      maximum: 10,
                      description: "Training consistency score out of 10",
                    },
                  },
                  required: [
                    "overallTrend",
                    "strengthGains",
                    "volumeProgression",
                    "consistencyScore",
                  ],
                },
                observations: {
                  type: "object",
                  properties: {
                    muscleGroupBalance: {
                      type: "string",
                      description:
                        "Assessment of muscle group training balance",
                    },
                    exerciseVariety: {
                      type: "string",
                      description: "Analysis of exercise selection and variety",
                    },
                    workoutFrequency: {
                      type: "string",
                      description:
                        "Evaluation of workout frequency and scheduling",
                    },
                    recoveryPatterns: {
                      type: "string",
                      description: "Insights on recovery and rest patterns",
                    },
                  },
                  required: [
                    "muscleGroupBalance",
                    "exerciseVariety",
                    "workoutFrequency",
                    "recoveryPatterns",
                  ],
                },
                suggestions: {
                  type: "object",
                  properties: {
                    immediateActions: {
                      type: "array",
                      items: { type: "string" },
                      description: "Actions to implement immediately",
                    },
                    programAdjustments: {
                      type: "array",
                      items: { type: "string" },
                      description: "Medium-term program modifications",
                    },
                    exerciseRecommendations: {
                      type: "array",
                      items: { type: "string" },
                      description: "Specific exercise recommendations",
                    },
                  },
                  required: [
                    "immediateActions",
                    "programAdjustments",
                    "exerciseRecommendations",
                  ],
                },
                thingsToTry: {
                  type: "object",
                  properties: {
                    newExercises: {
                      type: "array",
                      items: { type: "string" },
                      description: "New exercises to try",
                    },
                    trainingTechniques: {
                      type: "array",
                      items: { type: "string" },
                      description: "Training techniques to experiment with",
                    },
                    periodizationChanges: {
                      type: "array",
                      items: { type: "string" },
                      description:
                        "Periodization and programming changes to try",
                    },
                  },
                  required: [
                    "newExercises",
                    "trainingTechniques",
                    "periodizationChanges",
                  ],
                },
              },
              required: [
                "progressionAnalysis",
                "observations",
                "suggestions",
                "thingsToTry",
              ],
            },
          },
        ],
        tool_choice: { type: "tool", name: "provide_fitness_analysis" },
      });

      const toolUse = message.content.find(
        (content) => content.type === "tool_use",
      );

      if (!toolUse || toolUse.name !== "provide_fitness_analysis") {
        return err(
          new Error("AI did not provide the expected analysis format"),
        );
      }

      const validationResult = AIFitnessAnalysisSchema.safeParse(toolUse.input);

      if (!validationResult.success) {
        logger.error(
          { err: validationResult.error },
          "AI fitness analysis validation failed",
        );
        return err(
          new Error(`Invalid AI response: ${validationResult.error.message}`),
        );
      }

      const rawResponse = message.content
        .filter((content) => content.type === "text")
        .map((content) => content.text)
        .join(" ");

      return ok({
        analysis: validationResult.data,
        rawResponse,
        tokensUsed: message.usage.input_tokens + message.usage.output_tokens,
      });
    } catch (error) {
      logger.error({ err: error }, "AI fitness analysis error");
      return err(new Error("Failed to analyze workouts with AI"));
    }
  },

  buildAnalysisPrompt(data: WorkoutAnalysisData): string {
    return `You are an expert fitness coach analyzing ${data.timeframe.weeksActive} weeks of workout data from a dedicated trainee. Provide comprehensive, actionable feedback.

## Workout Summary
- **Timeframe**: ${data.timeframe.totalWorkouts} workouts over ${data.timeframe.weeksActive} weeks
- **Average Frequency**: ${data.progressionMetrics.frequencyTrends.averageWorkoutsPerWeek.toFixed(1)} workouts/week
- **Consistency Score**: ${data.progressionMetrics.frequencyTrends.consistencyScore}/10
- **Longest Streak**: ${data.progressionMetrics.frequencyTrends.longestStreak} consecutive workouts

## Strength Progression
${data.progressionMetrics.strengthProgression
  .map(
    (prog) =>
      `- **${prog.exercise}**: ${prog.startingWeight}kg → ${prog.currentWeight}kg (${prog.percentIncrease.toFixed(1)}% increase)`,
  )
  .join("\n")}

## Volume Analysis
${data.progressionMetrics.volumeProgression
  .map(
    (vol) =>
      `- **${vol.muscleGroup}**: ${vol.weeklyAverageVolume} sets/week (${vol.trend})`,
  )
  .join("\n")}

## Current Week Progress
${data.muscleGroupBalance.currentWeekVolume
  .map(
    (vol) =>
      `- **${vol.muscleGroup}**: ${vol.completedVolume}/${vol.targetVolume} sets (${vol.percentageComplete.toFixed(1)}%)`,
  )
  .join("\n")}

## Exercise Distribution
**Movement Patterns:**
${data.exerciseDistribution.movementPatterns
  .map((pattern) => `- ${pattern.pattern}: ${pattern.percentage.toFixed(1)}%`)
  .join("\n")}

**Equipment Usage:**
${data.exerciseDistribution.equipmentUsage
  .map((eq) => `- ${eq.type}: ${eq.percentage.toFixed(1)}%`)
  .join("\n")}

**Exercise Variety**: ${data.exerciseDistribution.exerciseVariety.totalUniqueExercises} unique exercises, ${data.exerciseDistribution.exerciseVariety.averageExercisesPerWorkout.toFixed(1)} exercises/workout

## Workout Characteristics
- **Average Duration**: ${data.workoutCharacteristics.averageDuration} minutes
- **Sets per Workout**: ${data.workoutCharacteristics.averageSetsPerWorkout.toFixed(1)}
- **Average Reps**: ${data.workoutCharacteristics.averageRepsPerSet.toFixed(1)}
- **Failure Sets**: ${data.workoutCharacteristics.failureSetPercentage.toFixed(1)}%
- **Warmup Sets**: ${data.workoutCharacteristics.warmupSetPercentage.toFixed(1)}%

## Analysis Requirements
1. **Progression Analysis**: Evaluate overall trend, strength gains, and volume progression
2. **Observations**: Assess muscle balance, exercise variety, frequency, and recovery
3. **Suggestions**: Provide immediate actions, program adjustments, and exercise recommendations
4. **Things to Try**: Suggest new exercises, techniques, and periodization changes

Focus on actionable, specific advice based on the data patterns. Consider progressive overload principles, balanced development, and sustainable progression.`;
  },
};
