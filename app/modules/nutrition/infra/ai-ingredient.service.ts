import Anthropic from "@anthropic-ai/sdk";
import { err, ok, type Result } from "neverthrow";
import { z } from "zod";
import { env } from "~/env.server";
import {
  ingredientCategories,
  textureCategories,
  type CreateIngredientInput,
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

export const AIIngredientService = {
  async searchIngredient(
    query: string,
  ): Promise<Result<AIIngredientSearchResult, Error>> {
    try {
      const client = getClient();

      const message = await client.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1000,
        messages: [
          {
            role: "user",
            content: `Find nutritional data for the ingredient: "${query}". If you can find reliable nutritional information, use the extract_ingredient_data tool to provide the data. If the ingredient is unknown or you cannot find reliable nutritional data, respond with a message explaining that the ingredient was not found.`,
          },
        ],
        tools: [
          {
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
                  description:
                    "Energy density in kcal/g (calories/100, range 0-9)",
                },
                texture: {
                  type: "string",
                  enum: [
                    "liquid",
                    "semi_liquid",
                    "soft_solid",
                    "firm_solid",
                    "powder",
                  ],
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
                  description:
                    "Suggested minimum portion size in grams (1-500 range)",
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
          },
        ],
        tool_choice: { type: "auto" },
      });

      // Check if the model used the tool
      const toolUse = message.content.find(
        (content) => content.type === "tool_use",
      );

      if (!toolUse) {
        // Model didn't use the tool, ingredient probably not found
        return ok({
          found: false,
          data: {} as CreateIngredientInput & {
            aiGenerated: true;
            aiGeneratedAt: Date;
          },
        });
      }

      // Validate the tool response with Zod
      const validationResult = AIIngredientResponseSchema.safeParse(
        toolUse.input,
      );

      if (!validationResult.success) {
        console.error(
          "AI tool response validation failed:",
          validationResult.error,
        );
        return err(
          new Error(`Invalid AI response: ${validationResult.error.message}`),
        );
      }

      const aiResponse = validationResult.data;

      const ingredientData: CreateIngredientInput & {
        aiGenerated: true;
        aiGeneratedAt: Date;
      } = {
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
      };

      return ok({
        found: true,
        data: ingredientData,
      });
    } catch (error) {
      console.error("AI ingredient search error:", error);
      return err(new Error("Failed to search ingredient with AI"));
    }
  },
};
