import Anthropic from "@anthropic-ai/sdk";
import { err, ok, type Result } from "neverthrow";
import { z } from "zod";
import { env } from "~/env.server";
import { logger } from "~/logger.server";
import {
  type CreateAIIngredientInput,
  ingredientCategories,
  textureCategories,
} from "../domain/ingredient";
import { IngredientRepository } from "./ingredient.repository.server";

export interface EstimationMessage {
  readonly role: "user" | "assistant";
  readonly content: string;
}

const EstimatedIngredientSchema = z.object({
  name: z.string().min(1),
  estimatedGrams: z.number().positive(),
  category: z.enum(ingredientCategories),
  calories: z.number().min(0).max(900),
  protein: z.number().min(0).max(100),
  carbs: z.number().min(0).max(100),
  fat: z.number().min(0).max(100),
  fiber: z.number().min(0).max(50),
  waterPercentage: z.number().min(0).max(100),
  energyDensity: z.number().min(0).max(9),
  texture: z.enum(textureCategories),
  isVegetarian: z.boolean(),
  isVegan: z.boolean(),
});

export type EstimatedIngredient = z.infer<typeof EstimatedIngredientSchema>;

const MealEstimationResultSchema = z.object({
  mealCategory: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  items: z.array(EstimatedIngredientSchema).min(1),
});

export type MealEstimationResult = z.infer<typeof MealEstimationResultSchema>;

export interface ResolvedIngredient {
  readonly ingredientId: string;
  readonly quantity: number;
}

export type ChatTurnResult =
  | { readonly type: "message"; readonly content: string }
  | { readonly type: "estimate"; readonly result: MealEstimationResult };

const estimateMealTool: Anthropic.Messages.Tool = {
  name: "estimate_meal",
  description:
    "Provide the final meal estimation with individual ingredients, quantities, and inferred meal category. Call this once you have enough information.",
  input_schema: {
    type: "object" as const,
    properties: {
      mealCategory: {
        type: "string",
        enum: ["breakfast", "lunch", "dinner", "snack"],
        description: "Inferred meal category based on foods described",
      },
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description:
                "Ingredient name in a simple, recognizable form (e.g., 'Rice Noodles' not 'rice noodles, cooked, drained')",
            },
            estimatedGrams: {
              type: "number",
              description: "Estimated quantity in grams for this meal portion",
            },
            category: {
              type: "string",
              enum: [...ingredientCategories],
              description: "Food category",
            },
            calories: {
              type: "number",
              description: "Calories per 100g (0-900)",
            },
            protein: {
              type: "number",
              description: "Protein grams per 100g (0-100)",
            },
            carbs: {
              type: "number",
              description: "Carbohydrates grams per 100g (0-100)",
            },
            fat: {
              type: "number",
              description: "Fat grams per 100g (0-100)",
            },
            fiber: {
              type: "number",
              description: "Fiber grams per 100g (0-50)",
            },
            waterPercentage: {
              type: "number",
              description: "Water content percentage (0-100)",
            },
            energyDensity: {
              type: "number",
              description: "Energy density in kcal/g (calories/100, 0-9)",
            },
            texture: {
              type: "string",
              enum: [...textureCategories],
              description: "Physical texture",
            },
            isVegetarian: { type: "boolean" },
            isVegan: { type: "boolean" },
          },
          required: [
            "name",
            "estimatedGrams",
            "category",
            "calories",
            "protein",
            "carbs",
            "fat",
            "fiber",
            "waterPercentage",
            "energyDensity",
            "texture",
            "isVegetarian",
            "isVegan",
          ],
        },
      },
    },
    required: ["mealCategory", "items"],
  },
};

function buildSystemPrompt(existingIngredientNames: readonly string[]): string {
  const namesList = existingIngredientNames.join(", ");

  return `You are a nutrition estimation assistant. The user will describe a meal they ate (often at a restaurant) and you must break it down into individual ingredients with estimated quantities and macronutrients.

## Your task
1. Decompose the described meal into individual raw/basic ingredients (e.g., "pad thai" becomes rice noodles, shrimp, egg, bean sprouts, peanuts, tamarind sauce, vegetable oil, etc.)
2. Estimate realistic restaurant portion sizes in grams for each ingredient
3. Provide accurate nutritional data per 100g for each ingredient
4. Infer the meal category (breakfast/lunch/dinner/snack) from the foods described

## When to ask clarifying questions
Ask a brief clarifying question if:
- The portion size is very ambiguous (e.g., "some pasta" — was it a side or a main?)
- The cooking method significantly changes macros (e.g., fried vs grilled)
- A key detail is missing that would swing the estimate by >20%

Do NOT ask about every minor detail. Make reasonable assumptions for typical restaurant portions and mention your assumptions in your response.

## When you have enough information
Call the estimate_meal tool with the full breakdown. All nutritional values must be per 100g.

## Existing ingredients in the database
Prefer using these exact names when they match what the user ate: ${namesList}

If an ingredient doesn't match any existing name, use a clear, simple name (e.g., "Tamarind Sauce" not "tamarind paste, prepared, diluted").`;
}

let anthropic: Anthropic | null = null;

function getClient(): Anthropic {
  if (!anthropic) {
    anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  }
  return anthropic;
}

function parseEstimationResponse(
  message: Anthropic.Messages.Message,
): Result<ChatTurnResult, Error> {
  const toolUse = message.content.find((block) => block.type === "tool_use");

  if (toolUse && toolUse.type === "tool_use") {
    const validation = MealEstimationResultSchema.safeParse(toolUse.input);
    if (!validation.success) {
      logger.error(
        { err: validation.error },
        "Meal estimation tool response validation failed",
      );
      return err(
        new Error(`Invalid estimation response: ${validation.error.message}`),
      );
    }
    return ok({ type: "estimate", result: validation.data });
  }

  const textBlocks = message.content.filter((block) => block.type === "text");
  const content = textBlocks.map((b) => (b as { text: string }).text).join("");

  if (!content) {
    return err(new Error("Empty response from AI"));
  }

  return ok({ type: "message", content });
}

export async function processChatTurn(
  messages: readonly EstimationMessage[],
): Promise<Result<ChatTurnResult, Error>> {
  try {
    const client = getClient();

    const ingredientsResult = await IngredientRepository.listAll();
    const existingNames = ingredientsResult.isOk()
      ? ingredientsResult.value.map((i) => i.name)
      : [];

    const response = await client.messages.create({
      model: env.ANTHROPIC_MODEL,
      max_tokens: 4096,
      system: buildSystemPrompt(existingNames),
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      tools: [estimateMealTool],
      tool_choice: { type: "auto" },
    });

    return parseEstimationResponse(response);
  } catch (error) {
    logger.error({ err: error }, "Meal estimation chat error");
    const message = error instanceof Error ? error.message : "Unknown error";
    return err(new Error(`Failed to process meal estimation: ${message}`));
  }
}

export async function resolveEstimatedIngredients(
  items: readonly EstimatedIngredient[],
): Promise<Result<readonly ResolvedIngredient[], Error>> {
  try {
    const allIngredientsResult = await IngredientRepository.listAll();
    if (allIngredientsResult.isErr()) {
      return err(new Error("Failed to load ingredients"));
    }
    const allIngredients = allIngredientsResult.value;

    const resolved: ResolvedIngredient[] = [];

    for (const item of items) {
      const match = allIngredients.find(
        (ing) => ing.name.toLowerCase() === item.name.toLowerCase(),
      );

      if (match) {
        resolved.push({
          ingredientId: match.id,
          quantity: item.estimatedGrams,
        });
        continue;
      }

      const input: CreateAIIngredientInput = {
        name: item.name,
        category: item.category,
        calories: item.calories,
        protein: item.protein,
        carbs: item.carbs,
        fat: item.fat,
        fiber: item.fiber,
        waterPercentage: item.waterPercentage,
        energyDensity: item.energyDensity,
        texture: item.texture,
        isVegetarian: item.isVegetarian,
        isVegan: item.isVegan,
        sliderMin: Math.max(10, Math.round(item.estimatedGrams * 0.3)),
        sliderMax: Math.max(
          Math.round(item.estimatedGrams * 0.3) + 10,
          Math.round(item.estimatedGrams * 3),
        ),
        aiGenerated: true,
        aiGeneratedAt: new Date(),
      };

      const saveResult = await IngredientRepository.save(input);
      if (saveResult.isErr()) {
        logger.error(
          { ingredientName: item.name },
          "Failed to create estimated ingredient",
        );
        return err(new Error(`Failed to create ingredient: ${item.name}`));
      }

      resolved.push({
        ingredientId: saveResult.value.id,
        quantity: item.estimatedGrams,
      });
    }

    return ok(resolved);
  } catch (error) {
    logger.error({ err: error }, "Resolve estimated ingredients error");
    return err(new Error("Failed to resolve ingredients"));
  }
}
