import {
  Badge,
  Box,
  Button,
  Card,
  Flex,
  Progress,
  Text,
} from "@radix-ui/themes";
import type { Route } from "./+types";
import { Link } from "react-router";
import { getNutritionPageData } from "~/modules/nutrition/application/nutrition-page.service.server";
import { SectionHeader } from "~/components/SectionHeader";

export async function loader() {
  return getNutritionPageData();
}

const mealLabels = {
  breakfast: "B",
  lunch: "L",
  dinner: "D",
  snack: "S",
} as const;

export const handle = {
  header: () => ({
    title: "Nutrition",
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
      <Card size="3" mb="4">
        <Flex justify="between" align="center" mb="3">
          <Text size="3" weight="medium">
            Today's Calories
          </Text>
          <Text size="2" color="gray">
            {Math.round(dailyTotals.calories)} / {calorieTarget}
          </Text>
        </Flex>
        <Progress value={calorieProgress} />

        <Flex gap="4" mt="4">
          <Box>
            <Text size="1" color="gray">
              Protein
            </Text>
            <Text size="3" weight="medium">
              {Math.round(dailyTotals.protein)}g
            </Text>
          </Box>
          <Box>
            <Text size="1" color="gray">
              Carbs
            </Text>
            <Text size="3" weight="medium">
              {Math.round(dailyTotals.carbs)}g
            </Text>
          </Box>
          <Box>
            <Text size="1" color="gray">
              Fat
            </Text>
            <Text size="3" weight="medium">
              {Math.round(dailyTotals.fat)}g
            </Text>
          </Box>
        </Flex>
      </Card>

      <Card size="3" mb="4">
        <SectionHeader title="Today's Meals" />
        <Flex gap="3">
          {(["breakfast", "lunch", "dinner", "snack"] as const).map(
            (mealType) => {
              const meal = meals[mealType];
              const hasLogged = meal !== null;
              return (
                <Badge
                  key={mealType}
                  size="2"
                  color={hasLogged ? "tomato" : "gray"}
                  variant={hasLogged ? "solid" : "outline"}
                >
                  {mealLabels[mealType]}
                </Badge>
              );
            },
          )}
        </Flex>
        <Flex direction="column" gap="2" mt="4">
          {(["breakfast", "lunch", "dinner", "snack"] as const).map(
            (mealType) => {
              const meal = meals[mealType];
              if (!meal) return null;
              return (
                <Flex key={mealType} justify="between" align="center">
                  <Text size="2" style={{ textTransform: "capitalize" }}>
                    {mealType}
                  </Text>
                  <Text size="2" color="gray">
                    {Math.round(meal.totals.calories)} cal
                  </Text>
                </Flex>
              );
            },
          )}
        </Flex>
      </Card>

      <Card size="3">
        <SectionHeader title="Tools" />
        <Flex direction="column" gap="3">
          <Button variant="outline" asChild>
            <Link to="/nutrition/meal-builder">Meal Builder</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/nutrition/calculate-targets">Calculate Targets</Link>
          </Button>
        </Flex>
      </Card>
    </Box>
  );
}
