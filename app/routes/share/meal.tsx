import { NutritionService } from "~/modules/nutrition/infra/service";
import {
  SharedMealView,
  type SharedMealViewModel,
} from "~/modules/nutrition/presentation";
import type { Route } from "./+types/meal";

export function meta({ data }: Route.MetaArgs) {
  const name = data?.meal.name ?? "Shared meal";
  return [
    { title: `${name} · Fitness` },
    {
      name: "description",
      content: "A shared meal with calories, macros, and ingredient details.",
    },
  ];
}

export async function loader({ params }: Route.LoaderArgs) {
  const result = await NutritionService.getPublicMealTemplateWithIngredients(
    params.id,
  );

  if (result.isErr()) {
    throw new Response("Meal not found", { status: 404 });
  }

  const template = result.value;
  const meal: SharedMealViewModel = {
    name: template.name,
    category: template.category,
    notes: template.notes,
    ingredients: template.ingredients,
  };

  return { meal };
}

export default function SharedMealPage({ loaderData }: Route.ComponentProps) {
  return <SharedMealView meal={loaderData.meal} />;
}
