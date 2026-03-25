import Anthropic from "@anthropic-ai/sdk";
import { err, ok, type Result } from "neverthrow";
import { z } from "zod";
import { env } from "~/env.server";
import { logger } from "~/logger.server";
import {
  type CreateIngredientInput,
  ingredientCategories,
  textureCategories,
} from "../domain/ingredient";

const AIIngredientResponseSchema = z
  .object({
    name: z.string().min(1),
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
    sliderMin: z.number().min(1).max(500),
    sliderMax: z.number().min(1).max(1000),
  })
  .refine((data) => data.sliderMax > data.sliderMin, {
    message: "sliderMax must be greater than sliderMin",
    path: ["sliderMax"],
  });

export interface AIIngredientSearchResult {
  found: boolean;
  data: CreateIngredientInput & {
    aiGenerated: true;
    aiGeneratedAt: Date;
  };
}

const extractIngredientTool: Anthropic.Messages.Tool = {
  name: "extract_ingredient_data",
  description: "Extract nutritional data for a food ingredient",
  input_schema: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: "The name of the ingredient",
      },
      category: {
        type: "string",
        enum: [
          "proteins",
          "grains",
          "vegetables",
          "fruits",
          "dairy",
          "fats_oils",
          "nuts_seeds",
          "legumes",
          "herbs_spices",
          "condiments",
          "beverages",
          "sweeteners",
          "other",
        ],
        description: "Food category of the ingredient",
      },
      calories: {
        type: "number",
        description: "Calories per 100g (0-900 range)",
      },
      protein: {
        type: "number",
        description: "Protein in grams per 100g (0-100 range)",
      },
      carbs: {
        type: "number",
        description: "Carbohydrates in grams per 100g (0-100 range)",
      },
      fat: {
        type: "number",
        description: "Fat in grams per 100g (0-100 range)",
      },
      fiber: {
        type: "number",
        description: "Fiber in grams per 100g (0-50 range)",
      },
      waterPercentage: {
        type: "number",
        description: "Water content percentage (0-100)",
      },
      energyDensity: {
        type: "number",
        description: "Energy density in kcal/g (calories/100, range 0-9)",
      },
      texture: {
        type: "string",
        enum: ["liquid", "semi_liquid", "soft_solid", "firm_solid", "powder"],
        description: "Physical texture of the ingredient",
      },
      isVegetarian: {
        type: "boolean",
        description: "Whether the ingredient is vegetarian",
      },
      isVegan: {
        type: "boolean",
        description: "Whether the ingredient is vegan",
      },
      sliderMin: {
        type: "number",
        description: "Suggested minimum portion size in grams (1-500 range)",
      },
      sliderMax: {
        type: "number",
        description:
          "Suggested maximum portion size in grams (higher than sliderMin, max 1000)",
      },
    },
    required: [
      "name",
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
      "sliderMin",
      "sliderMax",
    ],
  },
};

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

function parseIngredientResult(
  message: Anthropic.Messages.Message,
): Result<AIIngredientSearchResult, Error> {
  const toolUse = message.content.find(
    (content) => content.type === "tool_use",
  );

  if (!toolUse || toolUse.type !== "tool_use") {
    return ok({
      found: false,
      data: {} as AIIngredientSearchResult["data"],
    });
  }

  const validationResult = AIIngredientResponseSchema.safeParse(toolUse.input);

  if (!validationResult.success) {
    logger.error(
      { err: validationResult.error },
      "AI tool response validation failed",
    );
    return err(
      new Error(`Invalid AI response: ${validationResult.error.message}`),
    );
  }

  const aiResponse = validationResult.data;

  return ok({
    found: true,
    data: {
      name: aiResponse.name.trim(),
      category: aiResponse.category,
      calories: aiResponse.calories,
      protein: aiResponse.protein,
      carbs: aiResponse.carbs,
      fat: aiResponse.fat,
      fiber: aiResponse.fiber,
      waterPercentage: aiResponse.waterPercentage,
      energyDensity: aiResponse.energyDensity,
      texture: aiResponse.texture,
      isVegetarian: aiResponse.isVegetarian,
      isVegan: aiResponse.isVegan,
      sliderMin: aiResponse.sliderMin,
      sliderMax: aiResponse.sliderMax,
      aiGenerated: true,
      aiGeneratedAt: new Date(),
    },
  });
}

const SEARCH_PROMPT = `Find nutritional data for the ingredient: "{query}".

If this is a well-known whole food (e.g. chicken breast, banana, rice), use your knowledge directly.
If this is a branded product, supplement, or specialty item, use the web_search tool to find accurate nutritional information from the manufacturer's website or a reliable nutrition database.

Once you have reliable nutritional data, use the extract_ingredient_data tool. All values must be per 100g.
If the ingredient is unknown or you cannot find reliable nutritional data, respond with a text message explaining that.`;

export const AIIngredientService = {
  async searchIngredient(
    query: string,
  ): Promise<Result<AIIngredientSearchResult, Error>> {
    try {
      const client = getClient();

      const message = await client.messages.create({
        model: env.ANTHROPIC_MODEL,
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: SEARCH_PROMPT.replace("{query}", query),
          },
        ],
        tools: [
          { type: "web_search_20250305", name: "web_search" },
          extractIngredientTool,
        ],
        tool_choice: { type: "auto" },
      });

      return parseIngredientResult(message);
    } catch (error) {
      logger.error({ err: error }, "AI ingredient search error");
      return err(new Error("Failed to search ingredient with AI"));
    }
  },
};
