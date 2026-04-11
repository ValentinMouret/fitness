import type { ActionFunctionArgs } from "react-router";
import { z } from "zod";
import { zfd } from "zod-form-data";
import type {
  EstimatedIngredient,
  EstimationMessage,
} from "~/modules/nutrition/domain/meal-estimation";
import {
  processChatTurn,
  resolveEstimatedIngredients,
} from "~/modules/nutrition/infra/meal-estimation.service.server";
import { formText } from "~/utils/form-data";

const chatSchema = zfd.formData({
  intent: formText(z.literal("chat")),
  messages: formText(z.string().min(1)),
});

const resolveSchema = zfd.formData({
  intent: formText(z.literal("resolve")),
  items: formText(z.string().min(1)),
  mealCategory: formText(z.enum(["breakfast", "lunch", "dinner", "snack"])),
});

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "chat") {
    const parsed = chatSchema.parse(formData);
    const messages: EstimationMessage[] = JSON.parse(parsed.messages);

    const result = await processChatTurn(messages);

    if (result.isErr()) {
      return { error: result.error.message };
    }

    return result.value;
  }

  if (intent === "resolve") {
    const parsed = resolveSchema.parse(formData);
    const items: EstimatedIngredient[] = JSON.parse(parsed.items);

    const result = await resolveEstimatedIngredients(items);

    if (result.isErr()) {
      return { error: result.error.message };
    }

    return {
      ingredients: result.value,
      mealCategory: parsed.mealCategory,
    };
  }

  throw new Error("Invalid intent");
}
