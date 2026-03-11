import { Box, Button, Flex, Progress, Text } from "@radix-ui/themes";
import { Link } from "react-router";
import { getNutritionPageData } from "~/modules/nutrition/infra/nutrition-page.service.server";
import type { Route } from "./+types";
import "./index.css";

export async function loader() {
  return getNutritionPageData();
}

const mealTypes = ["breakfast", "lunch", "dinner", "snack"] as const;

const mealLabels: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snacks",
};

export const handle = {
  header: () => ({
    title: "Nutrition",
    subtitle: new Date().toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    }),
    primaryAction: {
      label: "Log Meal",
      to: "/nutrition/meals",
    },
  }),
};

export default function NutritionPage({ loaderData }: Route.ComponentProps) {
  const { calorieTarget, dailySummary } = loaderData;
  const { dailyTotals, meals } = dailySummary;

  const calorieProgress = Math.min(
    (dailyTotals.calories / calorieTarget) * 100,
    100,
  );

  return (
    <Box>
      {/* Daily Intake */}
      <Box mb="8">
        <p className="section-label">Daily Intake</p>
        <span className="display-number display-number--xl">
          {Math.round(dailyTotals.calories)}
          <span className="display-number--unit">kcal</span>
        </span>
        <Box mt="3">
          <Progress value={calorieProgress} />
          <Flex justify="between" mt="1">
            <Text size="1" className="nutrition__muted">
              {Math.round(calorieProgress)}% of target
            </Text>
            <Text size="1" className="nutrition__muted">
              {calorieTarget} kcal
            </Text>
          </Flex>
        </Box>
      </Box>

      {/* Macros */}
      <Box mb="8">
        <p className="section-label">Macros</p>
        <div className="nutrition__macro-grid">
          {[
            { value: dailyTotals.protein, label: "Protein", unit: "g" },
            { value: dailyTotals.carbs, label: "Carbs", unit: "g" },
            { value: dailyTotals.fat, label: "Fat", unit: "g" },
          ].map((macro) => (
            <Box key={macro.label} p="4" className="nutrition__macro-card">
              <span className="display-number display-number--lg">
                {Math.round(macro.value)}
              </span>
              <Text as="p" size="1" mt="1" className="nutrition__muted">
                {macro.unit}
              </Text>
              <Text
                as="p"
                size="1"
                mt="1"
                weight="medium"
                className="nutrition__macro-label"
              >
                {macro.label}
              </Text>
            </Box>
          ))}
        </div>
      </Box>

      {/* Meals */}
      <Box mb="8">
        <p className="section-label">Meals</p>
        <Box>
          {mealTypes.map((mealType, i) => {
            const meal = meals[mealType];
            const hasLogged = meal !== null;
            const ingredientNames = meal?.ingredients
              ?.map((ing) => ing.ingredient.name)
              .join(" · ");

            return (
              <Box key={mealType}>
                {i > 0 && <hr className="rule-divider" />}
                <Link to="/nutrition/meals" className="nutrition__meal-link">
                  <Box py="3">
                    <Flex justify="between" align="center">
                      <Flex align="center" gap="2">
                        <span
                          className={`nutrition__meal-status ${hasLogged ? "nutrition__meal-status--logged" : "nutrition__meal-status--empty"}`}
                        />
                        <Text size="3" weight="bold">
                          {mealLabels[mealType]}
                        </Text>
                      </Flex>
                      <Text size="2" className="nutrition__muted">
                        {hasLogged
                          ? `${Math.round(meal.totals.calories)} kcal`
                          : ""}
                      </Text>
                    </Flex>
                    {hasLogged && ingredientNames ? (
                      <Text
                        as="p"
                        size="2"
                        mt="1"
                        ml="5"
                        className="nutrition__meal-detail"
                      >
                        {ingredientNames}
                      </Text>
                    ) : !hasLogged ? (
                      <Text
                        as="p"
                        size="2"
                        mt="1"
                        ml="5"
                        className="nutrition__meal-empty"
                      >
                        Tap to log
                      </Text>
                    ) : null}
                  </Box>
                </Link>
              </Box>
            );
          })}
        </Box>
      </Box>

      {/* Tools — flat buttons */}
      <Flex gap="3" wrap="wrap">
        <Button variant="outline" size="2" asChild>
          <Link to="/nutrition/meal-builder">Meal Builder</Link>
        </Button>
        <Button variant="outline" size="2" asChild>
          <Link to="/nutrition/calculate-targets">Calculate Targets</Link>
        </Button>
      </Flex>
    </Box>
  );
}
