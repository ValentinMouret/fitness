import { Box, Button, Flex, Progress, Text } from "@radix-ui/themes";
import { Link } from "react-router";
import { getNutritionPageData } from "~/modules/nutrition/application/nutrition-page.service.server";
import type { Route } from "./+types";

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
            <Text size="1" style={{ color: "var(--brand-text-secondary)" }}>
              {Math.round(calorieProgress)}% of target
            </Text>
            <Text size="1" style={{ color: "var(--brand-text-secondary)" }}>
              {calorieTarget} kcal
            </Text>
          </Flex>
        </Box>
      </Box>

      {/* Macros */}
      <Box mb="8">
        <p className="section-label">Macros</p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: "0.75rem",
          }}
        >
          {[
            { value: dailyTotals.protein, label: "Protein", unit: "g" },
            { value: dailyTotals.carbs, label: "Carbs", unit: "g" },
            { value: dailyTotals.fat, label: "Fat", unit: "g" },
          ].map((macro) => (
            <Box
              key={macro.label}
              p="4"
              style={{
                background: "var(--brand-surface)",
                borderRadius: "12px",
                textAlign: "center",
              }}
            >
              <span className="display-number display-number--lg">
                {Math.round(macro.value)}
              </span>
              <Text
                as="p"
                size="1"
                mt="1"
                style={{ color: "var(--brand-text-secondary)" }}
              >
                {macro.unit}
              </Text>
              <Text
                as="p"
                size="1"
                mt="1"
                weight="medium"
                style={{
                  color: "var(--brand-text-secondary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  fontSize: "0.65rem",
                }}
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
                <Link
                  to="/nutrition/meals"
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <Box py="3">
                    <Flex justify="between" align="center">
                      <Flex align="center" gap="2">
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: hasLogged
                              ? "var(--brand-coral)"
                              : "var(--gray-5)",
                            flexShrink: 0,
                          }}
                        />
                        <Text size="3" weight="bold">
                          {mealLabels[mealType]}
                        </Text>
                      </Flex>
                      <Text
                        size="2"
                        style={{ color: "var(--brand-text-secondary)" }}
                      >
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
                        style={{ color: "var(--brand-text-secondary)" }}
                      >
                        {ingredientNames}
                      </Text>
                    ) : !hasLogged ? (
                      <Text
                        as="p"
                        size="2"
                        mt="1"
                        ml="5"
                        style={{
                          color: "var(--brand-text-secondary)",
                          fontStyle: "italic",
                        }}
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
